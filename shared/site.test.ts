import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SITE_NAME } from "./site.ts";

it("keeps the static document title in sync with SITE_NAME", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  expect(html).toContain(`<title>${SITE_NAME} · 菜谱</title>`);
});

it("loads the shared rende.fun top bar", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  expect(html).toContain('<script src="/shell/topbar.js" defer></script>');
});

it("loads Baidu analytics on the public page", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  expect(html).toContain("https://hm.baidu.com/hm.js?f4b1d2fc4d60c37f898b469f83237dab");
  const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
  expect(head.indexOf("hm.baidu.com")).toBeLessThan(head.indexOf("<title>"));
});
