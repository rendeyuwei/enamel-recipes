import { describe, expect, it } from "vitest";
import { COPY } from "./copy.ts";

const HAN = /[\u3400-\u9fff]/;

describe("interface copy", () => {
  it("keeps the Chinese interface sentences", () => {
    const zh = COPY.zh;
    expect(zh.homeTitle).toBe("家常菜本 · 菜谱");
    expect(zh.signedIn).toBe("已登录 · 管理员");
    expect(zh.emptyGuest).toBe("还没有菜谱，登录后可编辑，添加第一道菜");
    expect(zh.meta("2026-10-08", 2, 2)).toBe("2026-10-08 录入 · 2 种食材 · 2 步");
    expect(zh.tally(2, 1)).toBe("共 2 道 · 本周新增 1");
    expect(zh.photosHint(1)).toBe("最多 8 张，每张不超过 2MB · 已传 1 / 8 · 按顺序跟步骤");
    expect(zh.oneIngredient).toBe("一行一种");
    expect(zh.oneStep).toBe("一行一步");
  });

  it("keeps Han characters out of the English interface", () => {
    const en = COPY.en;
    expect(en.siteName).toBe("Home Recipes");
    for (const value of Object.values(en)) {
      if (typeof value === "string") expect(value).not.toMatch(HAN);
    }
    expect(en.tally(2, 1)).not.toMatch(HAN);
    expect(en.meta("2026-10-08", 1, 2)).toBe("Added 2026-10-08 · 1 ingredient · 2 steps");
    expect(en.viewPhoto("IMG_0412.jpg")).toBe("View photo IMG_0412.jpg");
  });
});
