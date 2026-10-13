import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openSession, readCookie, sessionCookie, signSession } from "../src/cookies.ts";
import { parseEnv } from "../src/env.ts";
import { hashPassword, verifyPassword } from "../src/password.ts";
import { LocalStore, assertObjectKey, createObjectStore } from "../src/store.ts";

const A = "a".repeat(32) + ".jpg";
const PARTIAL =
  "Set all of S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET or none.";

const oss = {
  S3_ENDPOINT: "https://oss-cn-hangzhou.aliyuncs.com",
  S3_REGION: "oss-cn-hangzhou",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_BUCKET: "caiben",
};

describe("password", () => {
  it("accepts the password that was hashed and rejects another", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("correct-horse", stored)).toBe(true);
    expect(verifyPassword("wrong-horse", stored)).toBe(false);
    expect(verifyPassword("correct-horse", "plaintext")).toBe(false);
  });
});

describe("session cookie", () => {
  it("round-trips a signed id and ignores a bad signature", () => {
    const token = signSession("abc", "secret-secret-secret");
    expect(openSession(token, "secret-secret-secret")).toBe("abc");
    expect(openSession(`${token}00`, "secret-secret-secret")).toBeNull();
    expect(openSession(token, "another-secret-value")).toBeNull();
    expect(sessionCookie("abc.def", false, 10)).toBe("caiben_session=abc.def; Path=/recipes; HttpOnly; SameSite=Lax; Max-Age=10");
    expect(sessionCookie("abc.def", true, 10)).toBe(
      "caiben_session=abc.def; Path=/recipes; HttpOnly; SameSite=Lax; Max-Age=10; Secure",
    );
    expect(readCookie("a=1; caiben_session=abc.def; b=2", "caiben_session")).toBe("abc.def");
  });
});

describe("parseEnv", () => {
  const valid = {
    ADMIN_USER: "rende",
    ADMIN_PASSWORD_HASH: `scrypt$${ "ab".repeat(16) }$${ "cd".repeat(32) }`,
    SESSION_SECRET: "0123456789abcdef",
  };

  it("defaults to a local store and rejects a partial S3 config", () => {
    expect(parseEnv(valid).s3).toBeNull();
    expect(parseEnv(valid).cookieSecure).toBe(true);
    expect(parseEnv({ ...valid, COOKIE_SECURE: "0" }).cookieSecure).toBe(false);
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);

    expect(
      parseEnv({
        ...valid,
        S3_ENDPOINT: " ",
        S3_REGION: " ",
        S3_ACCESS_KEY_ID: " ",
        S3_SECRET_ACCESS_KEY: " ",
        S3_BUCKET: " ",
        S3_PREFIX: "recipes/",
      }).s3,
    ).toBeNull();

    expect(() => parseEnv({ ...valid, S3_BUCKET: "caiben" })).toThrow(
      `${PARTIAL} Got S3_BUCKET.`,
    );

    expect(() =>
      parseEnv({ ...valid, S3_REGION: "oss-cn-hangzhou", S3_BUCKET: "caiben", S3_PREFIX: "recipes/" }),
    ).toThrow(/Got S3_REGION, S3_BUCKET\./);
    try {
      parseEnv({ ...valid, S3_REGION: "oss-cn-hangzhou", S3_BUCKET: "caiben", S3_PREFIX: "recipes/" });
    } catch (err) {
      expect((err as Error).message.includes("S3_PREFIX")).toBe(false);
    }

    expect(() =>
      parseEnv({
        ...valid,
        ...oss,
        S3_SECRET_ACCESS_KEY: " ",
      }),
    ).toThrow(`${PARTIAL} Got S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_BUCKET.`);

    expect(parseEnv({ ...valid, ...oss }).s3).toEqual({
      endpoint: "https://oss-cn-hangzhou.aliyuncs.com",
      region: "oss-cn-hangzhou",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: "caiben",
      prefix: "",
    });

    expect(parseEnv({ ...valid, ...oss, S3_PREFIX: " recipes/ " }).s3).toEqual({
      endpoint: "https://oss-cn-hangzhou.aliyuncs.com",
      region: "oss-cn-hangzhou",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: "caiben",
      prefix: "recipes/",
    });

    expect(() => parseEnv({ ...valid, ...oss, S3_PREFIX: "/recipes/" })).toThrow(
      "S3_PREFIX must not start with / or \\",
    );

    expect(parseEnv({ ...valid, ...oss, S3_PREFIX: "recipes" }).s3?.prefix).toBe("recipes");

    expect(parseEnv({ ...valid, S3_PREFIX: "/recipes/" }).s3).toBeNull();
  });
});

describe("object store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a file on disk and refuses a key that leaves the directory", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caiben-store-"));
    const store = new LocalStore(dir);
    await store.put("ab".repeat(16) + ".jpg", Buffer.from("jpeg"), "image/jpeg");
    expect((await store.get("ab".repeat(16) + ".jpg"))?.body.toString()).toBe("jpeg");
    await store.delete("ab".repeat(16) + ".jpg");
    expect(await store.get("ab".repeat(16) + ".jpg")).toBeNull();
    expect(() => assertObjectKey("../secret")).toThrow("bad object key");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function spySend() {
    const calls: string[] = [];
    vi.spyOn(S3Client.prototype, "send").mockImplementation(async function (this: S3Client, command) {
      const input = command.input as { Bucket?: string; Key?: string };
      calls.push(`${command.constructor.name}:${input.Bucket}:${input.Key}`);
      expect(this.config.forcePathStyle).toBe(false);
      expect(await this.config.region()).toBe("oss-cn-hangzhou");
      const resolveEndpoint = this.config.endpoint;
      if (!resolveEndpoint) throw new Error("missing endpoint");
      expect((await resolveEndpoint()).hostname).toBe("oss-cn-hangzhou.aliyuncs.com");
      const creds = await this.config.credentials();
      expect(creds.accessKeyId).toBe("key");
      expect(creds.secretAccessKey).toBe("secret");
      if (command.constructor.name === "GetObjectCommand" && input.Key === "recipes/missing.jpg") {
        throw { name: "NoSuchKey" };
      }
      if (command.constructor.name === "GetObjectCommand") {
        return {
          Body: { transformToByteArray: async () => Uint8Array.from([9, 9]) },
          ContentType: "image/jpeg",
        };
      }
      return {};
    });
    return calls;
  }

  it("prefixes object keys on OSS and treats a missing object as empty", async () => {
    const calls = spySend();
    const store = createObjectStore(parseEnv({ ...validEnv(), ...oss, S3_PREFIX: "recipes/" }));
    await expect(store.put("../secret", Buffer.from([1]), "image/jpeg")).rejects.toThrow("bad object key");
    await expect(store.put("recipes/x.jpg", Buffer.from([1]), "image/jpeg")).rejects.toThrow("bad object key");
    expect(calls).toEqual([]);
    await store.put(A, Buffer.from([1]), "image/jpeg");
    const got = await store.get(A);
    expect(got?.body).toEqual(Buffer.from([9, 9]));
    expect(got?.contentType).toBe("image/jpeg");
    expect(await store.get("missing.jpg")).toBeNull();
    await store.delete(A);
    expect(calls).toEqual([
      `PutObjectCommand:caiben:recipes/${A}`,
      `GetObjectCommand:caiben:recipes/${A}`,
      "GetObjectCommand:caiben:recipes/missing.jpg",
      `DeleteObjectCommand:caiben:recipes/${A}`,
    ]);
  });

  it("stores the key unchanged when S3_PREFIX is unset", async () => {
    const calls = spySend();
    const store = createObjectStore(parseEnv({ ...validEnv(), ...oss }));
    await store.put(A, Buffer.from([1]), "image/jpeg");
    expect(calls).toEqual([`PutObjectCommand:caiben:${A}`]);
  });

  it("writes a local file without applying S3_PREFIX", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "caiben-local-"));
    const store = createObjectStore(parseEnv({ ...validEnv(), DATA_DIR: tmp, S3_PREFIX: "recipes/" }));
    await store.put(A, Buffer.from("jpeg"), "image/jpeg");
    expect(fs.existsSync(path.join(tmp, "objects", A))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "objects", "recipes"))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

function validEnv() {
  return {
    ADMIN_USER: "rende",
    ADMIN_PASSWORD_HASH: `scrypt$${ "ab".repeat(16) }$${ "cd".repeat(32) }`,
    SESSION_SECRET: "0123456789abcdef",
  };
}
