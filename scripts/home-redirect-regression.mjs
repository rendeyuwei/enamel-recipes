// Chrome against a local copy of the public exact redirect:
// location = /recipes { return 301 /recipes/; } drops the query.
// Not part of npm test. Needs Chrome, puppeteer-core, the built client, and the dd5cc90 shell.
import { spawn } from "node:child_process";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "../server/src/password.ts";

const shellDir = process.env.RF_SHELL_DIR ?? "/tmp/rende-site-fdaa701/dist/shell";
const appPort = Number(process.env.PORT ?? 3045);
const proxyPort = appPort + 1;
const origin = `http://127.0.0.1:${proxyPort}`;
const root = "/tmp/recipes-home-redirect";
mkdirSync(join(root, "data"), { recursive: true });
const envFile = [
  "ADMIN_USER=preview",
  `ADMIN_PASSWORD_HASH=${hashPassword(randomBytes(18).toString("hex"))}`,
  `SESSION_SECRET=${randomBytes(24).toString("hex")}`,
  "COOKIE_SECURE=0",
  "TRUST_PROXY=0",
  `PORT=${appPort}`,
  `DATA_DIR=${join(root, "data")}`,
].join("\n");
writeFileSync(join(root, "env"), envFile, { mode: 0o600 });

const pinnedTopbar = "topbar.4a304e017601ad56e80a5c39886c186fa462161ce585d093ae92c4cfc17edd7b.js";
if (statSync(join(shellDir, "lang.js")).size !== 3755 || statSync(join(shellDir, pinnedTopbar)).size !== 9981) {
  throw new Error("shell is not the pinned 3755/9981 build");
}

const puppeteer = await import(process.env.PUPPETEER_CORE ?? "/tmp/preview-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js");
const child = spawn("npx", ["tsx", "server/src/index.ts"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: { ...process.env, ...Object.fromEntries(envFile.split("\n").map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])) },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let serverLog = "";
child.stdout.on("data", (chunk) => {
  serverLog += chunk;
});
child.stderr.on("data", (chunk) => {
  serverLog += chunk;
});

const problems = [];
function problem(step, detail) {
  problems.push({ step, detail });
  console.error(`FAIL ${step}: ${detail}`);
}

function stopChild() {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

async function waitForApp() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    try {
      if ((await fetch(`http://127.0.0.1:${appPort}/recipes/api/health`)).ok) return;
    } catch {
      await delay(200);
    }
  }
  throw new Error("server did not start");
}

const proxy = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/recipes") {
    res.writeHead(301, { location: "/recipes/" });
    res.end();
    return;
  }
  const upstream = http.request(
    { hostname: "127.0.0.1", port: appPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${appPort}` } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});

async function arm(page) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/shell/")) {
      const name = url.pathname.slice("/shell/".length);
      try {
        const body = readFileSync(join(shellDir, name));
        request.respond({ status: 200, contentType: name.endsWith(".css") ? "text/css" : "text/javascript", body });
      } catch {
        request.respond({ status: 404, body: "missing shell" });
      }
      return;
    }
    request.continue().catch(() => undefined);
  });
}

async function block(page) {
  await page.evaluateOnNewDocument(() => {
    const fail = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Storage.prototype.setItem = fail;
    Storage.prototype.getItem = fail;
    Object.defineProperty(Document.prototype, "cookie", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
      set() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    Object.defineProperty(Navigator.prototype, "languages", { get: () => ["en-US"] });
    Object.defineProperty(Navigator.prototype, "language", { get: () => "en-US" });
  });
}

function menu(shot) {
  return shot.tools.slice(0, 4).join("|");
}

async function main() {
  await waitForApp();
  await new Promise((resolve) => proxy.listen(proxyPort, "127.0.0.1", resolve));
  const bare = await fetch(`${origin}/recipes?q=1&lang=zh`, { redirect: "manual" });
  if (bare.status !== 301 || new URL(bare.headers.get("location") ?? "", origin).search) {
    problem("redirect", `${bare.status} ${bare.headers.get("location")}`);
  }
  const kept = await fetch(`${origin}/recipes/?q=1&lang=zh`, { redirect: "manual" });
  if (kept.status !== 200) problem("redirect", `slashed home ${kept.status}`);
  const login = await fetch(`${origin}/recipes/login?x=1`, { redirect: "manual" });
  if (login.status !== 200) problem("redirect", `login ${login.status}`);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(12000);
    const redirects = [];
    page.on("response", (res) => {
      if (res.status() === 301) redirects.push(res.url());
    });
    await block(page);
    await arm(page);
    await page.goto(`${origin}/recipes/en/?q=1#h`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("a.rf-lang");
    await page.evaluate(() => {
      window.__stay = 1;
    });
    const english = await page.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      tools: [...document.querySelectorAll(".rf-menu a")].map((anchor) => anchor.getAttribute("href")),
      loads: performance.getEntriesByType("navigation").length,
    }));
    if (english.url !== "/recipes/en/?q=1#h") problem("enter", english.url);
    if (menu(english) !== "/easypic/en/|/shutter/en/|/recipes/en/|/en/") problem("menu", menu(english));
    if (english.loads !== 1) problem("enter", `loads ${english.loads}`);
    const before = await page.evaluate(() => history.length);
    await page.click("a.rf-lang");
    await page.waitForFunction(() => location.pathname + location.search === "/recipes/?q=1&lang=zh");
    await delay(200);
    const chinese = await page.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      html: document.documentElement.lang,
      home: document.querySelector("a.brand")?.getAttribute("href"),
      tools: [...document.querySelectorAll(".rf-menu a")].map((anchor) => anchor.getAttribute("href")),
      stay: window.__stay,
      loads: performance.getEntriesByType("navigation").length,
      heading: document.querySelector("h1")?.textContent ?? "",
    }));
    if (chinese.url !== "/recipes/?q=1&lang=zh#h") problem("toggle", chinese.url);
    if (chinese.html !== "zh-CN" || !chinese.heading.includes("今天")) problem("toggle", `${chinese.html} ${chinese.heading}`);
    if (chinese.home !== "/recipes/") problem("home", chinese.home ?? "");
    if (menu(chinese) !== "/easypic/?lang=zh|/shutter/?lang=zh|/recipes/?lang=zh|/?lang=zh") problem("menu", menu(chinese));
    if ((await page.evaluate(() => history.length)) !== before + 1) problem("history", "extra entry");
    if (chinese.stay !== 1 || chinese.loads !== 1) problem("reload", "switch reloaded");
    await page.click("a.rf-lang");
    await page.waitForFunction(() => location.pathname + location.search + location.hash === "/recipes/en/?q=1#h");
    await delay(200);
    const backToEnglish = await page.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      html: document.documentElement.lang,
      tools: [...document.querySelectorAll(".rf-menu a")].map((anchor) => anchor.getAttribute("href")),
      stay: window.__stay,
      loads: performance.getEntriesByType("navigation").length,
    }));
    if (backToEnglish.url !== "/recipes/en/?q=1#h" || backToEnglish.html !== "en") problem("round", backToEnglish.url);
    if (menu(backToEnglish) !== "/easypic/en/|/shutter/en/|/recipes/en/|/en/") problem("round", menu(backToEnglish));
    if (backToEnglish.stay !== 1 || backToEnglish.loads !== 1) problem("round", "reloaded");
    if ((await page.evaluate(() => history.length)) !== before + 2) problem("history", "round trip added extra entries");
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => location.pathname + location.search === "/recipes/?q=1&lang=zh");
    await page.evaluate(() => history.forward());
    await page.waitForFunction(() => location.pathname + location.search + location.hash === "/recipes/en/?q=1#h");
    const restored = await page.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      html: document.documentElement.lang,
      stay: window.__stay,
    }));
    if (restored.url !== "/recipes/en/?q=1#h" || restored.html !== "en" || restored.stay !== 1) problem("history", restored.url);
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => location.pathname + location.search === "/recipes/?q=1&lang=zh");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1");
    const again = await page.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      html: document.documentElement.lang,
      heading: document.querySelector("h1")?.textContent ?? "",
    }));
    if (again.url !== "/recipes/?q=1&lang=zh#h" || again.html !== "zh-CN" || !again.heading.includes("今天")) {
      problem("refresh", `${again.url} ${again.html} ${again.heading}`);
    }
    const fresh = await browser.newPage();
    await block(fresh);
    await arm(fresh);
    await fresh.goto(`${origin}/recipes/?q=1&lang=zh#h`, { waitUntil: "domcontentloaded" });
    await fresh.waitForSelector("h1");
    const opened = await fresh.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      html: document.documentElement.lang,
      heading: document.querySelector("h1")?.textContent ?? "",
    }));
    if (opened.url !== "/recipes/?q=1&lang=zh#h" || opened.html !== "zh-CN" || !opened.heading.includes("今天")) {
      problem("new-tab", `${opened.url} ${opened.html}`);
    }
    if (redirects.length) problem("redirect", redirects.join(" "));
    writeFileSync("/tmp/recipes-home-redirect.json", JSON.stringify({ problems, english, chinese, again, opened }, null, 2));
  } finally {
    await browser.close();
    proxy.close();
    stopChild();
  }
  if (problems.length) {
    console.error(`${problems.length} home redirect checks failed`);
    process.exitCode = 1;
    return;
  }
  console.log("home redirect regression passed");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack.split("\n").slice(0, 8).join("\n") : "regression failed");
  if (serverLog) console.error(serverLog.slice(-400));
  stopChild();
  process.exit(1);
});
