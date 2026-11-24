// Real Chrome plus the local fdaa701 shell (rfLang v2, hashed topbar). Not part of npm test.
// Serves dist/shell/topbar.js, not only the vendored lang.js. Needs Chrome and puppeteer-core.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "../server/src/password.ts";

const shellDir = process.env.RF_SHELL_DIR ?? "/tmp/rende-site-fdaa701/dist/shell";
const port = Number(process.env.PORT ?? 3042);
const origin = `http://127.0.0.1:${port}`;
const root = "/tmp/recipes-shell-regression";
const password = randomBytes(18).toString("hex");
const user = "preview";
mkdirSync(join(root, "data"), { recursive: true });
const envFile = [
  `ADMIN_USER=${user}`,
  `ADMIN_PASSWORD_HASH=${hashPassword(password)}`,
  `SESSION_SECRET=${randomBytes(24).toString("hex")}`,
  "COOKIE_SECURE=0",
  "TRUST_PROXY=0",
  `PORT=${port}`,
  `DATA_DIR=${join(root, "data")}`,
].join("\n");
writeFileSync(join(root, "env"), envFile, { mode: 0o600 });
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);
writeFileSync(join(root, "EXAMPLE-photo.jpg"), jpeg);

const puppeteerPath = process.env.PUPPETEER_CORE ?? "/tmp/preview-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
const puppeteer = await import(puppeteerPath);

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

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    try {
      if ((await fetch(`${origin}/recipes/api/health`)).ok) return;
    } catch {
      await delay(200);
    }
  }
  throw new Error("server did not start");
}

async function arm(page) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/shell/")) {
      const name = url.pathname.slice("/shell/".length);
      try {
        const body = readFileSync(join(shellDir, name));
        const type = name.endsWith(".css") ? "text/css" : "text/javascript";
        request.respond({ status: 200, contentType: type, body });
      } catch {
        request.respond({ status: 404, body: "missing shell" });
      }
      return;
    }
    request.continue().catch(() => undefined);
  });
}

async function snap(page) {
  return page.evaluate(() => {
    const rf = window.rfLang;
    const link = document.querySelector("a.rf-lang");
    const bar = document.querySelector("header.rf-bar");
    const here = rf ? rf.place(location.pathname) : null;
    const title = document.querySelector("#title");
    let stored;
    try {
      stored = localStorage.getItem("rf-lang");
    } catch {
      stored = null;
    }
    return {
      url: location.pathname + location.search + location.hash,
      lang: here ? here.lang : null,
      htmlLang: document.documentElement.lang,
      barLang: bar ? bar.lang : null,
      label: link ? link.textContent : null,
      href: link ? link.getAttribute("href") : null,
      stored,
      title: document.title,
      tools: [...document.querySelectorAll(".rf-menu a")].map((anchor) => anchor.getAttribute("href")),
      liveTools: rf ? ["easypic", "shutter", "recipes"].map((id) => rf.siteHref(id)) : [],
      hreflang: [...document.querySelectorAll('link[rel="alternate"]')].map((node) => `${node.getAttribute("hreflang")}=${node.getAttribute("href")}`),
      draft: title instanceof HTMLInputElement ? title.value : null,
      ingredients: document.querySelector("#ingredients") instanceof HTMLTextAreaElement ? document.querySelector("#ingredients").value : null,
      steps: document.querySelector("#steps") instanceof HTMLTextAreaElement ? document.querySelector("#steps").value : null,
      uploadText: document.body.innerText.includes("1 / 8") || document.body.innerText.includes("已传 1 / 8"),
      images: document.querySelectorAll('img[src*="/recipes/img/"]').length,
      storageDump: (() => {
        const rows = [];
        try {
          for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            rows.push(`${key}=${localStorage.getItem(key)}`);
          }
        } catch {
          rows.push("localStorage blocked");
        }
        return rows.join("\n");
      })(),
    };
  });
}

function pageLang(url) {
  return url.includes("/en/") || url.endsWith("/en") ? "en" : "zh";
}

function expectAgreed(step, shot, options = {}) {
  const lang = options.expectLang ?? pageLang(shot.url);
  if (options.expectLang && pageLang(shot.url) !== options.expectLang) problem(step, `url ${shot.url}`);
  const html = lang === "en" ? "en" : "zh-CN";
  const label = lang === "en" ? "中文" : "EN";
  const site = lang === "en" ? "Home Recipes" : "家常菜本";
  if (shot.lang !== lang) problem(step, `url language ${shot.lang} for ${shot.url}`);
  if (shot.htmlLang !== html) problem(step, `html lang ${shot.htmlLang}`);
  if (shot.barLang !== html) problem(step, `bar lang ${shot.barLang}`);
  if (shot.label !== label) problem(step, `label ${shot.label}`);
  if (!shot.title.includes(site)) problem(step, `title ${shot.title}`);
  if (options.keep !== undefined && shot.stored !== options.keep) problem(step, `rf-lang ${shot.stored}`);
  else if (options.stored !== false && options.keep === undefined && shot.stored !== lang) problem(step, `rf-lang ${shot.stored}`);
  const hrefLang = pageLang(shot.href ?? "");
  if (hrefLang === lang) problem(step, `toggle href stays on ${shot.href}`);
  if (shot.tools.slice(0, 3).join("|") !== shot.liveTools.join("|")) {
    problem(step, `nav ${shot.tools.slice(0, 3).join("|")} live ${shot.liveTools.join("|")}`);
  }
  const zh = shot.hreflang.find((item) => item.startsWith("zh-CN="));
  const en = shot.hreflang.find((item) => item.startsWith("en="));
  if (!zh || !en) problem(step, `hreflang ${shot.hreflang.join(" ")}`);
  else if (lang === "en" && zh.includes("/recipes/en/")) problem(step, `zh hreflang ${zh}`);
  else if (lang === "zh" && !en.includes("/recipes/en/")) problem(step, `en hreflang ${en}`);
}

async function clickToggle(page, previous) {
  const before = await page.evaluate(() => history.length);
  await page.click("a.rf-lang");
  await page.waitForFunction((prior) => location.pathname + location.search !== prior, {}, previous);
  await delay(250);
  const after = await page.evaluate(() => history.length);
  if (after !== before + 1) problem("history", `${before} to ${after}`);
}

async function main() {
  const topbarSource = readFileSync(join(shellDir, "topbar.js"), "utf8");
  if (!topbarSource.includes("rf:locale") || !topbarSource.includes("popstate")) {
    throw new Error("shell directory is not the v2 topbar");
  }
  await waitForServer();
  const login = await fetch(`${origin}/recipes/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: user, password }),
  });
  const cookie = login.headers.get("set-cookie") ?? "";
  const created = await fetch(`${origin}/recipes/api/recipes`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookie.split(";")[0] },
    body: JSON.stringify({
      title: "EXAMPLE · 番茄炒蛋",
      douyinUrl: "",
      ingredientLines: ["番茄 2 个"],
      stepLines: ["炒到凝固"],
      imageKeys: [],
    }),
  });
  const id = (await created.json()).id;
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const sessionPair = cookie.split(";")[0] ?? "";
  const sessionValue = sessionPair.slice(sessionPair.indexOf("=") + 1);
  await browser.setCookie({
    name: "caiben_session",
    value: sessionValue,
    url: origin,
    path: "/recipes",
    httpOnly: true,
    sameSite: "Lax",
  });
  const seen = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(12000);
    await arm(page);
    await page.goto(`${origin}/recipes/en/${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("a.rf-lang");
    await page.evaluate(() => {
      window.__stay = 1;
    });
    seen.push({ step: "enter", ...(await snap(page)) });
    expectAgreed("enter", seen[0], { stored: false });
    for (let i = 1; i <= 4; i += 1) {
      await clickToggle(page, seen.at(-1).url.split("#")[0]);
      const shot = { step: `toggle-${i}`, ...(await snap(page)) };
      seen.push(shot);
      expectAgreed(`toggle-${i}`, shot);
    }
    await page.evaluate(() => history.back());
    await page.waitForFunction((before) => location.pathname + location.search !== before, {}, seen.at(-1).url.split("#")[0]);
    await delay(250);
    const back = { step: "back", ...(await snap(page)) };
    seen.push(back);
    expectAgreed("back", back, { stored: false, keep: "en" });
    await page.evaluate(() => history.forward());
    await page.waitForFunction((before) => location.pathname + location.search !== before, {}, back.url.split("#")[0]);
    await delay(250);
    const forward = { step: "forward", ...(await snap(page)) };
    seen.push(forward);
    expectAgreed("forward", forward);
    const stayed = await page.evaluate(() => ({
      token: window.__stay,
      loads: performance.getEntriesByType("navigation").length,
    }));
    if (stayed.token !== 1 || stayed.loads !== 1) problem("reload", `token ${stayed.token} loads ${stayed.loads}`);

    const again = await browser.newPage();
    await arm(again);
    await again.goto(`${origin}/recipes/`, { waitUntil: "domcontentloaded" });
    await again.waitForSelector("h1");
    await delay(300);
    const next = { step: "next-visit", ...(await snap(again)) };
    seen.push(next);
    expectAgreed("next-visit", next, { expectLang: "en" });
    await again.close();

    const editor = await browser.newPage();
    editor.setDefaultTimeout(12000);
    await arm(editor);
    let uploads = 0;
    editor.on("request", (req) => {
      if (req.method() !== "POST") return;
      if (req.url().includes("/api/uploads")) uploads += 1;
      if (req.url().includes("/api/recipes")) problem("draft", "recipe was submitted");
    });
    await editor.goto(`${origin}/recipes/en/new`, { waitUntil: "domcontentloaded" });
    try {
      await editor.waitForSelector("#title", { timeout: 4000 });
    } catch {
      problem("draft", `editor stayed at ${editor.url()}`);
      throw new Error("editor did not open");
    }
    const draft = "EXAMPLE unsaved draft";
    await editor.type("#title", draft);
    await editor.type("#ingredients", "番茄 1 个");
    await editor.type("#steps", "先切");
    const input = await editor.$('input[type="file"]');
    await input.uploadFile(join(root, "EXAMPLE-photo.jpg"));
    await editor.waitForFunction(() => document.body.innerText.includes("1 / 8"));
    for (let i = 1; i <= 4; i += 1) {
      const before = editor.url();
      await clickToggle(editor, new URL(before).pathname + new URL(before).search);
    }
    await editor.evaluate(() => history.back());
    await delay(250);
    await editor.evaluate(() => history.forward());
    await delay(250);
    const kept = await snap(editor);
    seen.push({ step: "draft", ...kept });
    if (kept.draft !== draft) problem("draft", `title ${kept.draft}`);
    if (kept.ingredients !== "番茄 1 个") problem("draft", `ingredients ${kept.ingredients}`);
    if (kept.steps !== "先切") problem("draft", `steps ${kept.steps}`);
    if (!kept.uploadText || kept.images !== 1) problem("draft", `photos ${kept.images}`);
    if (uploads !== 1) problem("draft", `upload requests ${uploads}`);
    if (kept.storageDump.includes(draft)) problem("draft", "private text was stored");

    const guest = await browser.newPage();
    guest.setDefaultTimeout(12000);
    await arm(guest);
    let loginPosts = 0;
    guest.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/login")) loginPosts += 1;
    });
    await guest.goto(`${origin}/recipes/en/login`, { waitUntil: "domcontentloaded" });
    await guest.waitForSelector("#username");
    const loginName = "preview-user";
    await guest.type("#username", loginName);
    await guest.type("#password", "not-sent");
    for (let i = 1; i <= 4; i += 1) {
      const before = new URL(guest.url());
      await clickToggle(guest, before.pathname + before.search);
    }
    const loginFields = await guest.evaluate(() => ({
      user: document.querySelector("#username") instanceof HTMLInputElement ? document.querySelector("#username").value : "",
      pass: document.querySelector("#password") instanceof HTMLInputElement ? document.querySelector("#password").value : "",
    }));
    if (loginFields.user !== loginName || loginFields.pass !== "not-sent") problem("login", "fields changed");
    if (loginPosts !== 0) problem("login", "form submitted");

    const returning = await browser.newPage();
    returning.setDefaultTimeout(12000);
    await arm(returning);
    await returning.goto(`${origin}/recipes/en/login?next=%2Frecipes%2Fen%2F12&q=1#form`, { waitUntil: "domcontentloaded" });
    await returning.waitForSelector("#username");
    await returning.type("#username", "preview-user");
    await returning.type("#password", "not-sent");
    await returning.click("a.rf-lang");
    await returning.waitForFunction(() => location.pathname === "/recipes/login");
    await delay(200);
    const returned = await returning.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      user: document.querySelector("#username") instanceof HTMLInputElement ? document.querySelector("#username").value : "",
      pass: document.querySelector("#password") instanceof HTMLInputElement ? document.querySelector("#password").value : "",
      focus: document.activeElement instanceof HTMLAnchorElement ? document.activeElement.className : "",
    }));
    if (returned.url !== "/recipes/login?next=%2Frecipes%2Fen%2F12&q=1&lang=zh#form") problem("next", returned.url);
    if (returned.user !== "preview-user" || returned.pass !== "not-sent") problem("next", "fields changed");
    if (returned.focus !== "rf-lang") problem("focus", returned.focus);

    const invalid = await browser.newPage();
    invalid.setDefaultTimeout(12000);
    await arm(invalid);
    await invalid.goto(`${origin}/recipes/en/new?q=1#draft`, { waitUntil: "domcontentloaded" });
    await invalid.waitForSelector("#title");
    await invalid.click("button.btn.fill");
    await invalid.waitForSelector(".err");
    const englishError = await invalid.evaluate(() => document.querySelector(".err")?.textContent ?? "");
    if (englishError !== "Enter a dish name.") problem("error", englishError);
    await invalid.click("a.rf-lang");
    await invalid.waitForFunction(() => location.pathname === "/recipes/new");
    await delay(200);
    const chineseError = await invalid.evaluate(() => ({
      url: location.pathname + location.search + location.hash,
      error: document.querySelector(".err")?.textContent ?? "",
      title: document.querySelector("#title") instanceof HTMLInputElement ? document.querySelector("#title").value : "missing",
      loads: performance.getEntriesByType("navigation").length,
    }));
    if (chineseError.url !== "/recipes/new?q=1&lang=zh#draft") problem("error", chineseError.url);
    if (chineseError.error !== "请填写菜名" || chineseError.title !== "") problem("error", `${chineseError.error} ${chineseError.title}`);
    if (chineseError.loads !== 1) problem("error", "reloaded");

    for (const width of [320, 390]) {
      const narrow = await browser.newPage();
      narrow.setDefaultTimeout(12000);
      await narrow.setViewport({ width, height: 700, isMobile: true, hasTouch: true });
      await arm(narrow);
      await narrow.goto(`${origin}/recipes/en/?q=1#h`, { waitUntil: "domcontentloaded" });
      await narrow.waitForSelector("a.rf-lang");
      await narrow.click("a.rf-lang");
      await narrow.waitForFunction(() => location.pathname === "/recipes/");
      await delay(200);
      const fitted = await narrow.evaluate(() => ({
        url: location.pathname + location.search + location.hash,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        names: [...document.querySelectorAll(".rf-n")].map((node) => node.textContent).join("|"),
      }));
      if (fitted.url !== "/recipes/?q=1&lang=zh#h") problem(`mobile-${width}`, fitted.url);
      if (fitted.overflow > 1) problem(`mobile-${width}`, `overflow ${fitted.overflow}`);
      if (!fitted.names.includes("家常菜本")) problem(`mobile-${width}`, fitted.names);
      await narrow.close();
    }

    const blocked = await browser.newPage();
    blocked.setDefaultTimeout(12000);
    await blocked.evaluateOnNewDocument(() => {
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
    });
    await arm(blocked);
    await blocked.goto(`${origin}/recipes/en/${id}`, { waitUntil: "domcontentloaded" });
    await blocked.waitForSelector("a.rf-lang");
    await clickToggle(blocked, `/recipes/en/${id}`);
    const blockedZh = await snap(blocked);
    if (!blockedZh.url.includes("lang=zh") || blockedZh.htmlLang !== "zh-CN" || blockedZh.label !== "EN") {
      problem("blocked", `${blockedZh.url} ${blockedZh.htmlLang} ${blockedZh.label}`);
    }
    await clickToggle(blocked, blockedZh.url.split("#")[0]);
    const blockedEn = await snap(blocked);
    if (pageLang(blockedEn.url) !== "en" || blockedEn.label !== "中文") problem("blocked", blockedEn.url);
  } finally {
    writeFileSync("/tmp/recipes-shell-regression.json", JSON.stringify({ problems, seen }, null, 2));
    await browser.close();
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
  if (problems.length) {
    console.error(`${problems.length} shell checks failed`);
    process.exitCode = 1;
    return;
  }
  console.log("shell toggle regression passed");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : "regression failed");
  if (serverLog) console.error(serverLog.slice(-500));
  try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  process.exit(1);
});
