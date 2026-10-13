import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES } from "../../shared/domain.ts";
import { buildApp } from "../src/app.ts";
import type { Env } from "../src/env.ts";
import { hashPassword } from "../src/password.ts";
import { LocalStore } from "../src/store.ts";

const secret = "test-session-secret";
let passwordHash = "";

beforeAll(() => {
  passwordHash = hashPassword("secret-secret");
});

function env(dataDir: string, extra: Partial<Env> = {}): Env {
  return {
    adminUser: "rende",
    adminPasswordHash: passwordHash,
    sessionSecret: secret,
    cookieSecure: false,
    trustProxy: false,
    dataDir,
    port: 3030,
    r2: null,
    ...extra,
  };
}

const apps: { close: () => Promise<void>; dir: string }[] = [];

afterEach(async () => {
  for (const item of apps.splice(0)) {
    await item.close();
    fs.rmSync(item.dir, { recursive: true, force: true });
  }
});

async function make(options: { secure?: boolean; limits?: Parameters<typeof buildApp>[0]["limits"]; now?: () => Date; dist?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caiben-"));
  let clientDist: string | undefined;
  if (options.dist) {
    clientDist = path.join(dir, "dist");
    fs.mkdirSync(clientDist);
    fs.writeFileSync(path.join(clientDist, "index.html"), '<!doctype html><div id="root"></div>');
    fs.mkdirSync(path.join(clientDist, "assets"));
    fs.writeFileSync(path.join(clientDist, "assets", "app.js"), "console.log(1)");
  }
  const built = await buildApp({
    env: env(dir, { cookieSecure: options.secure ?? false }),
    dbPath: path.join(dir, "t.sqlite"),
    store: new LocalStore(path.join(dir, "objects")),
    logger: false,
    now: options.now ?? (() => new Date("2026-10-12T04:00:00.000Z")),
    limits: options.limits,
    clientDist,
  });
  apps.push({ close: () => built.app.close(), dir });
  return { app: built.app, repo: built.repo, dir };
}

function cookiePair(setCookie: string | string[] | undefined): string {
  const line = Array.isArray(setCookie) ? setCookie[0] : String(setCookie ?? "");
  return line.split(";")[0] ?? "";
}

function multipart(buf: Buffer, filename: string) {
  const boundary = "----caibenboundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    buf,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

const baseRecipe = {
  title: "番茄炒蛋",
  douyinUrl: "https://v.douyin.com/iRk8aXc/",
  ingredientLines: ["番茄 2 个", "鸡蛋 3 个"],
  stepLines: ["炒到凝固"],
  imageKeys: [] as string[],
};

describe("recipes API", () => {
  it("serves health as json and the spa shell for pages", async () => {
    const { app } = await make({ dist: true });
    const health = await app.inject({ method: "GET", url: "/recipes/api/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true });
    expect(health.headers["cache-control"]).toBe("no-store");
    const page = await app.inject({ method: "GET", url: "/recipes/login" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('<div id="root"></div>');
    const asset = await app.inject({ method: "GET", url: "/recipes/assets/app.js" });
    expect(asset.body).toBe("console.log(1)");
    expect(asset.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("rejects a logged-out write and a wrong password with one message", async () => {
    const { app } = await make();
    const denied = await app.inject({ method: "POST", url: "/recipes/api/recipes", payload: baseRecipe });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toEqual({ error: "请先登录" });

    const badPassword = await app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "nope" },
    });
    const badUser = await app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "someone", password: "secret-secret" },
    });
    expect(badPassword.statusCode).toBe(401);
    expect(badUser.statusCode).toBe(401);
    expect(badPassword.json()).toEqual({ error: "账号或密码不对，再试一次。" });
    expect(badUser.json()).toEqual(badPassword.json());
  });

  it("sets an HttpOnly session cookie and clears it on logout", async () => {
    const { app } = await make();
    const login = await app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "secret-secret" },
    });
    expect(login.statusCode).toBe(204);
    const header = String(login.headers["set-cookie"]);
    expect(header).toMatch(/^caiben_session=[a-f0-9]{64}\.[a-f0-9]{64}; Path=\/recipes; HttpOnly; SameSite=Lax; Max-Age=1209600$/);
    const cookie = cookiePair(login.headers["set-cookie"]);
    const session = await app.inject({ method: "GET", url: "/recipes/api/session", headers: { cookie } });
    expect(session.json()).toEqual({ authenticated: true });
    const logout = await app.inject({ method: "POST", url: "/recipes/api/logout", headers: { cookie } });
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers["set-cookie"])).toBe("caiben_session=; Path=/recipes; HttpOnly; SameSite=Lax; Max-Age=0");
    const after = await app.inject({ method: "GET", url: "/recipes/api/session", headers: { cookie } });
    expect(after.json()).toEqual({ authenticated: false });
  });

  it("adds Secure when the cookie flag is on", async () => {
    const { app } = await make({ secure: true });
    const login = await app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "secret-secret" },
    });
    expect(String(login.headers["set-cookie"])).toMatch(/; Secure$/);
  });

  it("blocks login after the failure budget and blocks extra writes", async () => {
    const limited = await make({ limits: { loginFailures: 2, loginWindowMs: 60_000, writes: 20, writeWindowMs: 60_000 } });
    const body = { username: "rende", password: "nope" };
    expect((await limited.app.inject({ method: "POST", url: "/recipes/api/login", payload: body })).statusCode).toBe(401);
    expect((await limited.app.inject({ method: "POST", url: "/recipes/api/login", payload: body })).statusCode).toBe(401);
    const blocked = await limited.app.inject({ method: "POST", url: "/recipes/api/login", payload: body });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({ error: "试得太勤了，等一会儿再登录。" });

    const writes = await make({ limits: { loginFailures: 10, writes: 1, writeWindowMs: 60_000 } });
    const login = await writes.app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "secret-secret" },
    });
    expect(login.statusCode).toBe(204);
    const cookie = cookiePair(login.headers["set-cookie"]);
    const first = await writes.app.inject({ method: "POST", url: "/recipes/api/recipes", headers: { cookie }, payload: baseRecipe });
    expect(first.statusCode).toBe(201);
    const second = await writes.app.inject({ method: "POST", url: "/recipes/api/recipes", headers: { cookie }, payload: baseRecipe });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toEqual({ error: "写得太勤了，等一会儿再试。" });
  });

  it("creates, searches, updates, and rejects a script-looking title as text", async () => {
    const { app } = await make();
    const login = await app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "secret-secret" },
    });
    const cookie = cookiePair(login.headers["set-cookie"]);
    const created = await app.inject({
      method: "POST",
      url: "/recipes/api/recipes",
      headers: { cookie },
      payload: { ...baseRecipe, title: "<script>alert(1)</script>" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers["content-type"]).toContain("application/json");
    expect(created.json().title).toBe("<script>alert(1)</script>");
    const potato = await app.inject({
      method: "POST",
      url: "/recipes/api/recipes",
      headers: { cookie },
      payload: {
        title: "酸辣土豆丝",
        douyinUrl: "",
        ingredientLines: ["土豆 1 个"],
        stepLines: ["快炒"],
        imageKeys: [],
      },
    });
    expect(potato.statusCode).toBe(201);
    const found = await app.inject({ method: "GET", url: "/recipes/api/recipes?q=土豆" });
    expect(found.json().total).toBe(2);
    expect(found.json().recipes.map((recipe: { title: string }) => recipe.title)).toEqual(["酸辣土豆丝"]);
    const week = await app.inject({ method: "GET", url: "/recipes/api/recipes" });
    expect(week.json().addedThisWeek).toBe(2);
    const updated = await app.inject({
      method: "PUT",
      url: `/recipes/api/recipes/${potato.json().id}`,
      headers: { cookie },
      payload: {
        title: "酸辣土豆丝",
        douyinUrl: "",
        ingredientLines: ["土豆 2 个"],
        stepLines: ["快炒", "淋醋"],
        imageKeys: [],
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().steps).toEqual(["快炒", "淋醋"]);
    expect(updated.json().ingredients).toEqual([{ name: "土豆", amount: "2 个" }]);
  });

  it("stores a jpeg, refuses other bytes and oversized files, and deletes objects with the recipe", async () => {
    const { app, dir } = await make();
    const login = await app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "secret-secret" },
    });
    const cookie = cookiePair(login.headers["set-cookie"]);
    const uploaded = await app.inject({
      method: "POST",
      url: "/recipes/api/uploads",
      headers: { ...multipart(jpeg, "IMG_0412.jpg").headers, cookie },
      payload: multipart(jpeg, "IMG_0412.jpg").payload,
    });
    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.json()).toMatchObject({ filename: "IMG_0412.jpg", bytes: jpeg.length, contentType: "image/jpeg" });
    const key = uploaded.json().key as string;
    expect(key).toMatch(/^[a-f0-9]{32}\.jpg$/);
    const image = await app.inject({ method: "GET", url: `/recipes/img/${key}` });
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toContain("image/jpeg");
    expect(image.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(image.rawPayload).equals(jpeg)).toBe(true);

    const gif = await app.inject({
      method: "POST",
      url: "/recipes/api/uploads",
      headers: { ...multipart(Buffer.from("GIF89aXXXX"), "a.gif").headers, cookie },
      payload: multipart(Buffer.from("GIF89aXXXX"), "a.gif").payload,
    });
    expect(gif.statusCode).toBe(400);
    expect(gif.json()).toEqual({ error: "只能上传 JPEG、PNG 或 WebP" });

    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1, 0);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    const oversized = await app.inject({
      method: "POST",
      url: "/recipes/api/uploads",
      headers: { ...multipart(big, "big.jpg").headers, cookie },
      payload: multipart(big, "big.jpg").payload,
    });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: "单张图片不能超过 2MB" });

    const tooMany = await app.inject({
      method: "POST",
      url: "/recipes/api/recipes",
      headers: { cookie },
      payload: { ...baseRecipe, imageKeys: Array.from({ length: 9 }, () => `${"ab".repeat(16)}.jpg`) },
    });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json().error).toBe("一道菜最多 8 张截图");

    const created = await app.inject({
      method: "POST",
      url: "/recipes/api/recipes",
      headers: { cookie },
      payload: { ...baseRecipe, imageKeys: [key] },
    });
    expect(created.statusCode).toBe(201);
    const file = path.join(dir, "objects", key);
    expect(fs.existsSync(file)).toBe(true);
    const removed = await app.inject({
      method: "DELETE",
      url: `/recipes/api/recipes/${created.json().id}`,
      headers: { cookie },
    });
    expect(removed.statusCode).toBe(204);
    expect(fs.existsSync(file)).toBe(false);
    const gone = await app.inject({ method: "GET", url: `/recipes/img/${key}` });
    expect(gone.statusCode).toBe(404);
  });

  it("drops a removed image file when the recipe is saved without it", async () => {
    const { app, dir } = await make();
    const login = await app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "secret-secret" },
    });
    const cookie = cookiePair(login.headers["set-cookie"]);
    const uploaded = await app.inject({
      method: "POST",
      url: "/recipes/api/uploads",
      headers: { ...multipart(jpeg, "a.jpg").headers, cookie },
      payload: multipart(jpeg, "a.jpg").payload,
    });
    const key = uploaded.json().key as string;
    const created = await app.inject({
      method: "POST",
      url: "/recipes/api/recipes",
      headers: { cookie },
      payload: { ...baseRecipe, imageKeys: [key] },
    });
    const updated = await app.inject({
      method: "PUT",
      url: `/recipes/api/recipes/${created.json().id}`,
      headers: { cookie },
      payload: { ...baseRecipe, imageKeys: [] },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().images).toEqual([]);
    expect(fs.existsSync(path.join(dir, "objects", key))).toBe(false);
  });

  it("sweeps pending uploads older than a day on the next boot", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caiben-sweep-"));
    const dbPath = path.join(dir, "t.sqlite");
    const store = () => new LocalStore(path.join(dir, "objects"));
    const first = await buildApp({
      env: env(dir),
      dbPath,
      store: store(),
      logger: false,
      now: () => new Date("2026-10-12T04:00:00.000Z"),
    });
    const login = await first.app.inject({
      method: "POST",
      url: "/recipes/api/login",
      payload: { username: "rende", password: "secret-secret" },
    });
    const cookie = cookiePair(login.headers["set-cookie"]);
    const uploaded = await first.app.inject({
      method: "POST",
      url: "/recipes/api/uploads",
      headers: { ...multipart(jpeg, "later.jpg").headers, cookie },
      payload: multipart(jpeg, "later.jpg").payload,
    });
    const key = uploaded.json().key as string;
    expect(fs.existsSync(path.join(dir, "objects", key))).toBe(true);
    await first.app.close();
    const second = await buildApp({
      env: env(dir),
      dbPath,
      store: store(),
      logger: false,
      now: () => new Date("2026-10-14T04:00:00.000Z"),
    });
    apps.push({ close: () => second.app.close(), dir });
    expect(fs.existsSync(path.join(dir, "objects", key))).toBe(false);
    const missing = await second.app.inject({ method: "GET", url: `/recipes/img/${key}` });
    expect(missing.statusCode).toBe(404);
  });
});
