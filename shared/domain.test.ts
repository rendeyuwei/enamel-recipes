import { describe, expect, it } from "vitest";
import {
  attachImages,
  coverGlyph,
  formatBytes,
  formatShanghaiDate,
  isInShanghaiWeek,
  parseIngredientLine,
  recipeMatches,
  safeFilename,
  safeNext,
  shanghaiWeekStart,
  sniffImage,
  validateWrite,
} from "./domain.ts";

describe("parseIngredientLine", () => {
  it("splits the amount off the first whitespace", () => {
    expect(parseIngredientLine("番茄 2 个")).toEqual({ name: "番茄", amount: "2 个" });
    expect(parseIngredientLine("盐 适量")).toEqual({ name: "盐", amount: "适量" });
    expect(parseIngredientLine("郫县豆瓣 1 勺")).toEqual({ name: "郫县豆瓣", amount: "1 勺" });
    expect(parseIngredientLine("嫩豆腐")).toEqual({ name: "嫩豆腐", amount: "" });
    expect(parseIngredientLine("   ")).toBeNull();
  });
});

describe("sniffImage", () => {
  it("recognizes jpeg, png, and webp magic bytes", () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toEqual({
      contentType: "image/jpeg",
      ext: ".jpg",
    });
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toEqual({
      contentType: "image/png",
      ext: ".png",
    });
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImage(webp)).toEqual({ contentType: "image/webp", ext: ".webp" });
    expect(sniffImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });
});

describe("safeFilename", () => {
  it("drops directories and keeps a short basename", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("IMG_0412.jpg")).toBe("IMG_0412.jpg");
    expect(safeFilename("炒蛋凝固.png")).toBe("炒蛋凝固.png");
    expect(safeFilename("")).toBe("image");
  });
});

describe("formatBytes", () => {
  it("prints the design's megabyte labels", () => {
    expect(formatBytes(1363149)).toBe("1.3MB");
    expect(formatBytes(943718)).toBe("0.9MB");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(500)).toBe("1KB");
  });
});

describe("coverGlyph", () => {
  it("uses the first character and a stable tone", () => {
    expect(coverGlyph("番茄炒蛋")).toEqual({ char: "番", tone: "pale" });
  });
});

describe("shanghai week", () => {
  it("starts Monday at 00:00 in Shanghai", () => {
    expect(shanghaiWeekStart(new Date("2026-10-12T04:00:00.000Z")).toISOString()).toBe(
      "2026-10-11T16:00:00.000Z",
    );
    expect(shanghaiWeekStart(new Date("2026-10-11T15:30:00.000Z")).toISOString()).toBe(
      "2026-10-04T16:00:00.000Z",
    );
    expect(isInShanghaiWeek("2026-10-11T16:00:00.000Z", new Date("2026-10-12T04:00:00.000Z"))).toBe(true);
    expect(isInShanghaiWeek("2026-10-11T15:59:59.000Z", new Date("2026-10-12T04:00:00.000Z"))).toBe(false);
  });
});

describe("formatShanghaiDate", () => {
  it("formats the civil date in Shanghai", () => {
    expect(formatShanghaiDate("2026-10-08T02:00:00.000Z")).toBe("2026-10-08");
    expect(formatShanghaiDate("2026-10-07T16:00:00.000Z")).toBe("2026-10-08");
    expect(formatShanghaiDate("2026-10-07T15:00:00.000Z")).toBe("2026-10-07");
  });
});

describe("recipeMatches", () => {
  const egg = { title: "番茄炒蛋", ingredients: [{ name: "鸡蛋", amount: "3 个" }] };
  const potato = { title: "酸辣土豆丝", ingredients: [{ name: "土豆", amount: "1 根" }] };

  it("matches a title or an ingredient and ignores a blank query", () => {
    expect(recipeMatches(potato, "土豆")).toBe(true);
    expect(recipeMatches(egg, "鸡蛋")).toBe(true);
    expect(recipeMatches(egg, "土豆")).toBe(false);
    expect(recipeMatches(egg, "   ")).toBe(true);
  });
});

describe("attachImages", () => {
  it("puts image i on step i and leaves extras on the last step", () => {
    expect(attachImages(["切", "炒"], ["a", "b", "c"])).toEqual([
      { text: "切", images: ["a"] },
      { text: "炒", images: ["b", "c"] },
    ]);
  });
});

describe("safeNext", () => {
  it("allows a site path and drops external targets", () => {
    expect(safeNext("/new")).toBe("/new");
    expect(safeNext("/1/edit")).toBe("/1/edit");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("validateWrite", () => {
  const good = {
    title: "番茄炒蛋",
    douyinUrl: "https://v.douyin.com/iRk8aXc/",
    ingredientLines: ["番茄 2 个"],
    stepLines: ["炒熟"],
    imageKeys: [],
  };

  it("accepts a minimal recipe and normalizes the url", () => {
    const parsed = validateWrite(good);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual({
      title: "番茄炒蛋",
      douyinUrl: "https://v.douyin.com/iRk8aXc/",
      ingredients: [{ name: "番茄", amount: "2 个" }],
      steps: ["炒熟"],
      imageKeys: [],
    });
  });

  it("rejects an empty title, a javascript url, too many images, and no steps", () => {
    expect(validateWrite({ ...good, title: "  " })).toMatchObject({ error: "请填写菜名" });
    expect(validateWrite({ ...good, douyinUrl: "javascript:alert(1)" })).toMatchObject({
      error: "抖音链接要是 http 或 https 网址",
    });
    expect(
      validateWrite({
        ...good,
        imageKeys: Array.from({ length: 9 }, () => "a".repeat(32) + ".jpg"),
      }),
    ).toMatchObject({ error: "一道菜最多 8 张截图" });
    expect(validateWrite({ ...good, stepLines: ["  "] })).toMatchObject({ error: "至少写一步" });
    expect(validateWrite({ ...good, ingredientLines: [] })).toMatchObject({ error: "至少写一种食材" });
    expect(validateWrite({ ...good, stepLines: Array.from({ length: 41 }, () => "一步") })).toMatchObject({
      error: "最多 40 步",
    });
  });
});
