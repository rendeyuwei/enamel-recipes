import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { MAX_IMAGE_BYTES, safeFilename, sniffImage, validateWrite } from "../../shared/domain.ts";
import {
  readCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  openSession,
  sessionCookie,
  signSession,
} from "./cookies.ts";
import { openDatabase } from "./db.ts";
import type { Env } from "./env.ts";
import { HttpError } from "./http.ts";
import { createLimiter } from "./limiter.ts";
import { verifyPassword } from "./password.ts";
import { createRepo, type Repo } from "./repo.ts";
import { createObjectStore, type ObjectStore } from "./store.ts";

export type BuildOptions = {
  env: Env;
  dbPath: string;
  store?: ObjectStore;
  now?: () => Date;
  logger?: boolean;
  clientDist?: string;
  limits?: {
    loginFailures?: number;
    loginWindowMs?: number;
    writes?: number;
    writeWindowMs?: number;
  };
};

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

function statusOf(err: unknown): number {
  if (err instanceof HttpError) return err.statusCode;
  if (typeof err === "object" && err !== null && "statusCode" in err && typeof err.statusCode === "number") {
    return err.statusCode;
  }
  return 500;
}

function mime(file: string): string {
  switch (path.extname(file)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function inside(root: string, file: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(file);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
}

export async function buildApp(opts: BuildOptions): Promise<{ app: FastifyInstance; repo: Repo }> {
  const env = opts.env;
  const now = opts.now ?? (() => new Date());
  const db = openDatabase(opts.dbPath);
  const repo = createRepo(db);
  const store = opts.store ?? createObjectStore(env);
  const dist = opts.clientDist ?? path.join(process.cwd(), "client/dist");
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: env.trustProxy });
  await app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

  const loginLimit = createLimiter({
    limit: opts.limits?.loginFailures ?? 5,
    windowMs: opts.limits?.loginWindowMs ?? 15 * 60 * 1000,
    now: () => now().getTime(),
  });
  const writeLimit = createLimiter({
    limit: opts.limits?.writes ?? 30,
    windowMs: opts.limits?.writeWindowMs ?? 60 * 1000,
    now: () => now().getTime(),
  });

  const stale = repo.sweepPending(new Date(now().getTime() - PENDING_TTL_MS).toISOString());
  for (const key of stale) await store.delete(key);

  app.addHook("onSend", async (req, reply, payload) => {
    if (req.url.startsWith("/recipes/api")) reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    return payload;
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    const status = statusOf(err);
    if (status >= 500) req.log.error(err);
    let message = "服务器出错了";
    if (err instanceof HttpError) message = err.message;
    else if (status === 413) message = "单张图片不能超过 2MB";
    else if (status < 500) message = "请求格式不对";
    const body = err instanceof HttpError && err.fields ? { error: message, fields: err.fields } : { error: message };
    reply.code(status).send(body);
  });

  app.addHook("onClose", async () => {
    db.close();
  });

  function currentSession(req: FastifyRequest): string | null {
    const raw = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!raw) return null;
    const id = openSession(raw, env.sessionSecret);
    if (!id || !repo.validSession(id, now().getTime())) return null;
    return id;
  }

  function requireUser(req: FastifyRequest) {
    if (!currentSession(req)) throw new HttpError(401, "请先登录");
  }

  app.addHook("onRequest", async (req, reply) => {
    if (req.method !== "POST" && req.method !== "PUT" && req.method !== "DELETE") return;
    const pathOnly = req.url.split("?")[0];
    if (pathOnly === "/recipes/api/login") return;
    if (!currentSession(req)) return;
    const decision = writeLimit.take(req.ip);
    if (!decision.ok) {
      reply.header("retry-after", String(decision.retryAfterSec));
      throw new HttpError(429, "写得太勤了，等一会儿再试。");
    }
  });

  async function serveIndex(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const html = await fs.readFile(path.join(dist, "index.html"));
      return reply.type("text/html; charset=utf-8").send(html);
    } catch {
      return reply.code(503).type("text/plain; charset=utf-8").send("前端还没构建。先运行 npm run build。");
    }
  }

  async function serveFile(root: string, rel: string, reply: FastifyReply, cache: string | null) {
    if (rel.includes("\0")) throw new HttpError(400, "请求格式不对");
    const file = path.resolve(root, rel);
    if (!inside(root, file)) throw new HttpError(400, "请求格式不对");
    try {
      const body = await fs.readFile(file);
      if (cache) reply.header("cache-control", cache);
      return reply.type(mime(file)).send(body);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new HttpError(404, "没有这个文件");
      throw err;
    }
  }

  app.get("/recipes/api/health", async () => ({ ok: true }));

  app.get("/recipes/api/session", async (req) => ({ authenticated: currentSession(req) !== null }));

  app.post("/recipes/api/login", async (req, reply) => {
    const gate = loginLimit.blocked(req.ip);
    if (gate.blocked) {
      reply.header("retry-after", String(gate.retryAfterSec));
      throw new HttpError(429, "试得太勤了，等一会儿再登录。");
    }
    const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const passwordOk = verifyPassword(password, env.adminPasswordHash);
    if (!passwordOk || username !== env.adminUser) {
      loginLimit.hit(req.ip);
      throw new HttpError(401, "账号或密码不对，再试一次。");
    }
    loginLimit.reset(req.ip);
    const id = randomBytes(32).toString("hex");
    repo.createSession(id, now().getTime() + SESSION_MAX_AGE_SEC * 1000);
    reply.header("set-cookie", sessionCookie(signSession(id, env.sessionSecret), env.cookieSecure));
    return reply.code(204).send();
  });

  app.post("/recipes/api/logout", async (req, reply) => {
    const id = currentSession(req);
    reply.header("set-cookie", sessionCookie("", env.cookieSecure, 0));
    if (!id) throw new HttpError(401, "请先登录");
    repo.deleteSession(id);
    return reply.code(204).send();
  });

  app.get("/recipes/api/recipes", async (req) => {
    const raw = (req.query as { q?: unknown }).q;
    const q = typeof raw === "string" ? raw.slice(0, 80) : "";
    return repo.list(q, now());
  });

  app.get("/recipes/api/recipes/:id", async (req) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new HttpError(404, "没有这道菜");
    const recipe = repo.get(id);
    if (!recipe) throw new HttpError(404, "没有这道菜");
    return recipe;
  });

  app.post("/recipes/api/recipes", async (req, reply) => {
    requireUser(req);
    const parsed = validateWrite(req.body);
    if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.fields);
    const stamp = now().toISOString();
    const saved = repo.create(parsed.value, stamp, stamp);
    if (!saved.ok) throw new HttpError(saved.status, saved.error);
    return reply.code(201).send(saved.recipe);
  });

  app.put("/recipes/api/recipes/:id", async (req) => {
    requireUser(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new HttpError(404, "没有这道菜");
    const parsed = validateWrite(req.body);
    if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.fields);
    const saved = repo.update(id, parsed.value, now().toISOString());
    if (!saved.ok) throw new HttpError(saved.status, saved.error);
    for (const key of saved.removedKeys) await store.delete(key);
    return saved.recipe;
  });

  app.delete("/recipes/api/recipes/:id", async (req, reply) => {
    requireUser(req);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) throw new HttpError(404, "没有这道菜");
    const keys = repo.remove(id);
    if (!keys) throw new HttpError(404, "没有这道菜");
    for (const key of keys) await store.delete(key);
    return reply.code(204).send();
  });

  app.post("/recipes/api/uploads", async (req) => {
    requireUser(req);
    const file = await req.file();
    if (!file) throw new HttpError(400, "没有收到图片");
    const buf = await file.toBuffer();
    if (buf.length > MAX_IMAGE_BYTES) throw new HttpError(400, "单张图片不能超过 2MB");
    const sniffed = sniffImage(buf);
    if (!sniffed) throw new HttpError(400, "只能上传 JPEG、PNG 或 WebP");
    const key = randomBytes(16).toString("hex") + sniffed.ext;
    await store.put(key, buf, sniffed.contentType);
    const image = {
      key,
      filename: safeFilename(file.filename),
      bytes: buf.length,
      contentType: sniffed.contentType,
      createdAt: now().toISOString(),
    };
    try {
      repo.addImage(image);
    } catch (err) {
      await store.delete(key);
      throw err;
    }
    return { key: image.key, filename: image.filename, bytes: image.bytes, contentType: image.contentType };
  });

  app.delete("/recipes/api/uploads/:key", async (req, reply) => {
    requireUser(req);
    const key = (req.params as { key: string }).key;
    if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(key)) throw new HttpError(400, "截图无效");
    const result = repo.deletePending(key);
    if (result === "missing") throw new HttpError(404, "没有这张截图");
    if (result === "attached") throw new HttpError(409, "这张图还在菜谱上");
    await store.delete(key);
    return reply.code(204).send();
  });

  app.get("/recipes/img/:key", async (req, reply) => {
    const key = (req.params as { key: string }).key;
    if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(key)) throw new HttpError(400, "截图无效");
    const meta = repo.image(key);
    if (!meta) throw new HttpError(404, "没有这张截图");
    const obj = await store.get(key);
    if (!obj) throw new HttpError(404, "没有这张截图");
    reply.header("cache-control", "public, max-age=31536000, immutable");
    return reply.type(meta.contentType).send(obj.body);
  });

  app.get("/recipes/assets/*", async (req, reply) => {
    return serveFile(path.join(dist, "assets"), (req.params as { "*": string })["*"], reply, "public, max-age=31536000, immutable");
  });

  app.get("/recipes", serveIndex);
  app.get("/recipes/", serveIndex);
  app.get("/recipes/*", async (req, reply) => {
    const rel = (req.params as { "*": string })["*"];
    if (rel.startsWith("api/") || rel.startsWith("img/") || rel.startsWith("assets/")) {
      throw new HttpError(404, "没有这个地址");
    }
    if (rel && !rel.endsWith("/")) {
      const file = path.resolve(dist, rel);
      if (inside(dist, file)) {
        try {
          const body = await fs.readFile(file);
          return reply.type(mime(file)).send(body);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
      }
    }
    return serveIndex(req, reply);
  });

  return { app, repo };
}
