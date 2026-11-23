import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SITE_NAME } from "./site.ts";

it("keeps the static document title in sync with SITE_NAME", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  expect(html).toContain(`<title>${SITE_NAME} · 菜谱</title>`);
});

it("declares both languages and skips analytics when the decision is leaving", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  expect(html).toContain('lang="zh-CN"');
  expect(html).toContain('rel="canonical" href="https://rende.fun/recipes/"');
  expect(html).toContain('hreflang="zh-CN" href="https://rende.fun/recipes/"');
  expect(html).toContain('hreflang="en" href="https://rende.fun/recipes/en/"');
  expect(html).toContain('hreflang="x-default" href="https://rende.fun/recipes/en/"');
  expect(html).toContain('<meta name="rf-mount" content="/recipes/" />');
  expect(html).toContain('<script data-rf-enter src="/shell/lang.js"></script>');
  expect(html).toContain("https://hm.baidu.com/hm.js?f4b1d2fc4d60c37f898b469f83237dab");
  expect(html).toContain("window.rfLang && window.rfLang.leaving");
  const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
  expect(head.indexOf("data-rf-enter")).toBeLessThan(head.indexOf("hm.baidu.com"));
  expect(html).toContain('<script src="/shell/topbar.js" defer data-tool="recipes"></script>');
});
