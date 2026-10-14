import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SITE_NAME } from "./site.ts";

it("keeps the static document title in sync with SITE_NAME", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  expect(html).toContain(`<title>${SITE_NAME} · 菜谱</title>`);
});
