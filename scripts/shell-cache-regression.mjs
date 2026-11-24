// Disk cache of the old Chinese /shell/topbar.js must not paint the new English page.
// Not part of npm test. Needs Chrome. Serves only local files; it does not request hashed shell URLs.
import http from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const shellDir = process.env.RF_SHELL_DIR ?? "/tmp/rende-site-fdaa701/dist/shell";
const oldTopbarPath = process.env.RF_OLD_TOPBAR ?? "/tmp/rende-site-oldzh/dist/shell/topbar.js";
const topbarName = "topbar.4a304e017601ad56e80a5c39886c186fa462161ce585d093ae92c4cfc17edd7b.js";
const cssName = "topbar.918f2c1a3eaa24581dfb11b360b323fa925b5a2548108b6ad5d8bd98ff3cc23b.css";
const port = Number(process.env.PORT ?? 3057);
const origin = `http://127.0.0.1:${port}`;
const root = new URL("..", import.meta.url).pathname;
const englishFile = join(root, "client/dist/en/index.html");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const oldTopbar = readFileSync(oldTopbarPath);
const newTopbar = readFileSync(join(shellDir, topbarName));
const css = readFileSync(join(shellDir, cssName));
const englishHtml = readFileSync(englishFile);
if (oldTopbar.length !== 5661 || !oldTopbar.includes(Buffer.from("家常菜本")) || oldTopbar.includes(Buffer.from("Home Recipes"))) {
  throw new Error("old topbar is not the Chinese-only build");
}
if (newTopbar.length !== 9981 || sha256(newTopbar) !== topbarName.split(".")[1]) throw new Error("new topbar bytes drifted");
if (css.length !== 2807 || sha256(css) !== cssName.split(".")[1]) throw new Error("shell css bytes drifted");
if (!englishHtml.includes(Buffer.from('lang="en"'))) throw new Error("English shell was not built");

let alias = oldTopbar;
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", origin);
  const send = (status, body, type, cache) => {
    res.writeHead(status, { "content-type": type, "cache-control": cache, "content-length": body.length });
    res.end(body);
  };
  if (url.pathname === "/shell/topbar.js") {
    send(200, alias, "text/javascript; charset=utf-8", "public, max-age=31536000, immutable");
    return;
  }
  if (url.pathname === `/shell/${topbarName}`) {
    send(200, newTopbar, "text/javascript; charset=utf-8", "public, max-age=31536000, immutable");
    return;
  }
  if (url.pathname === `/shell/${cssName}` || url.pathname === "/shell/topbar.css") {
    send(200, css, "text/css; charset=utf-8", "public, max-age=31536000, immutable");
    return;
  }
  if (url.pathname === "/primer/") {
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><script src="/shell/topbar.js" defer></script></body></html>`;
    send(200, Buffer.from(html), "text/html; charset=utf-8", "no-cache");
    return;
  }
  if (url.pathname === "/recipes/en" || url.pathname === "/recipes/en/" || url.pathname === "/recipes/en/index.html") {
    send(200, englishHtml, "text/html; charset=utf-8", "no-cache");
    return;
  }
  if (url.pathname.startsWith("/recipes/")) {
    try {
      const body = readFileSync(join(root, "client/dist", url.pathname.slice("/recipes/".length)));
      const type = url.pathname.endsWith(".css") ? "text/css" : "text/javascript";
      send(200, body, type, "public, max-age=31536000, immutable");
      return;
    } catch {
      send(404, Buffer.from("missing"), "text/plain", "no-store");
      return;
    }
  }
  send(404, Buffer.from("missing"), "text/plain", "no-store");
});

const puppeteer = await import(process.env.PUPPETEER_CORE ?? "/tmp/preview-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js");
const profile = mkdtempSync(join(tmpdir(), "recipes-shell-cache-"));
const problems = [];
function problem(step, detail) {
  problems.push({ step, detail });
  console.error(`FAIL ${step}: ${detail}`);
}

function launch() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    headless: true,
    userDataDir: profile,
    args: ["--no-sandbox", "--disable-dev-shm-usage", `--disk-cache-dir=${join(profile, "disk")}`],
  });
}

async function menu(page) {
  await page.waitForSelector(".rf-n");
  return page.evaluate(() => ({
    names: [...document.querySelectorAll(".rf-n")].map((node) => node.textContent),
    hrefs: [...document.querySelectorAll(".rf-menu a")].map((node) => node.getAttribute("href")),
    src: [...document.scripts].map((node) => node.getAttribute("src")).find((src) => src && src.includes("topbar")) ?? "",
    url: location.pathname + location.search + location.hash,
  }));
}

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
try {
  const first = await launch();
  try {
    const page = await first.newPage();
    page.setDefaultTimeout(12000);
    const seen = [];
    page.on("response", (res) => {
      if (new URL(res.url()).pathname === "/shell/topbar.js") seen.push({ cache: res.fromCache(), status: res.status() });
    });
    await page.goto(`${origin}/primer/`, { waitUntil: "domcontentloaded" });
    const primed = await menu(page);
    if (!primed.names.includes("家常菜本") || primed.names.includes("Home Recipes")) problem("prime", primed.names.join("|"));
    if (seen.some((item) => item.cache) || seen[0]?.status !== 200) problem("prime", JSON.stringify(seen));
  } finally {
    await first.close();
  }
  alias = newTopbar;
  if (alias.length === oldTopbar.length) throw new Error("alias was not flipped");
  const second = await launch();
  try {
    const page = await second.newPage();
    page.setDefaultTimeout(12000);
    const hits = [];
    page.on("response", async (res) => {
      const path = new URL(res.url()).pathname;
      if (!path.startsWith("/shell/topbar")) return;
      const body = await res.buffer().catch(() => Buffer.alloc(0));
      hits.push({ path, cache: res.fromCache(), status: res.status(), bytes: body.length, sha: sha256(body) });
    });
    await page.goto(`${origin}/recipes/en/?q=1#h`, { waitUntil: "domcontentloaded" });
    await delay(200);
    const view = await menu(page);
    const englishNames = ["EasyPic", "ShutterCount", "Home Recipes", "All tools"];
    if (view.names.join("|") !== englishNames.join("|")) problem("menu", view.names.join("|"));
    if (view.hrefs.join("|") !== "/easypic/en/|/shutter/en/|/recipes/en/|/en/") problem("menu", view.hrefs.join("|"));
    if (view.src !== `/shell/${topbarName}`) problem("src", view.src);
    if (view.url !== "/recipes/en/?q=1#h") problem("url", view.url);
    const hashed = hits.find((item) => item.path === `/shell/${topbarName}`);
    if (!hashed || hashed.cache || hashed.bytes !== 9981 || hashed.sha !== topbarName.split(".")[1]) {
      problem("asset", JSON.stringify(hits));
    }
    const cssHit = hits.find((item) => item.path === `/shell/${cssName}`);
    if (!cssHit || cssHit.cache || cssHit.bytes !== 2807 || cssHit.sha !== cssName.split(".")[1]) {
      problem("css", JSON.stringify(hits));
    }
    const cached = [];
    page.on("response", async (res) => {
      if (new URL(res.url()).pathname !== "/shell/topbar.js") return;
      const body = await res.buffer().catch(() => Buffer.alloc(0));
      cached.push({ cache: res.fromCache(), bytes: body.length, sha: sha256(body) });
    });
    await page.goto(`${origin}/primer/`, { waitUntil: "domcontentloaded" });
    const again = await menu(page);
    if (!cached[0]?.cache || cached[0].bytes !== oldTopbar.length || cached[0].sha !== sha256(oldTopbar)) {
      problem("disk", JSON.stringify(cached));
    }
    if (!again.names.includes("家常菜本")) problem("disk", again.names.join("|"));
  } finally {
    await second.close();
  }
} finally {
  server.close();
  rmSync(profile, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`${problems.length} shell cache checks failed`);
  process.exit(1);
}
console.log("shell cache regression passed");
