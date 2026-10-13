import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { openSession, readCookie, sessionCookie, signSession } from "../src/cookies.ts";
import { parseEnv } from "../src/env.ts";
import { hashPassword, verifyPassword } from "../src/password.ts";
import { LocalStore, R2Store, assertObjectKey } from "../src/store.ts";

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

  it("defaults to a local store and rejects a partial R2 config", () => {
    expect(parseEnv(valid).r2).toBeNull();
    expect(parseEnv(valid).cookieSecure).toBe(true);
    expect(parseEnv({ ...valid, COOKIE_SECURE: "0" }).cookieSecure).toBe(false);
    expect(() => parseEnv({ ...valid, R2_BUCKET: "caiben" })).toThrow(/Set all of/);
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });
});

describe("object store", () => {
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

  it("sends the bucket and key to R2 and treats a missing object as empty", async () => {
    const calls: string[] = [];
    const store = new R2Store(
      { accountId: "acc", accessKeyId: "key", secretAccessKey: "secret", bucket: "caiben" },
      async (command) => {
        const input = command.input as { Bucket?: string; Key?: string };
        calls.push(`${command.constructor.name}:${input.Bucket}:${input.Key}`);
        if (command instanceof GetObjectCommand && input.Key === "missing.jpg") {
          throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
        }
        if (command instanceof GetObjectCommand) {
          return {
            Body: { transformToByteArray: async () => Uint8Array.from([9, 9]) },
            ContentType: "image/jpeg",
          };
        }
        return {};
      },
    );
    await store.put("a".repeat(32) + ".jpg", Buffer.from([1]), "image/jpeg");
    const got = await store.get("a".repeat(32) + ".jpg");
    expect(got?.body).toEqual(Buffer.from([9, 9]));
    expect(got?.contentType).toBe("image/jpeg");
    expect(await store.get("missing.jpg")).toBeNull();
    await store.delete("a".repeat(32) + ".jpg");
    expect(calls).toEqual([
      `PutObjectCommand:caiben:${"a".repeat(32)}.jpg`,
      `GetObjectCommand:caiben:${"a".repeat(32)}.jpg`,
      "GetObjectCommand:caiben:missing.jpg",
      `DeleteObjectCommand:caiben:${"a".repeat(32)}.jpg`,
    ]);
    expect(new PutObjectCommand({ Bucket: "caiben", Key: "k" }).constructor.name).toBe("PutObjectCommand");
    expect(new DeleteObjectCommand({ Bucket: "caiben", Key: "k" }).constructor.name).toBe("DeleteObjectCommand");
  });
});
