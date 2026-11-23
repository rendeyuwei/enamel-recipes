import { describe, expect, it } from "vitest";
import { parseMounted, parseRouter, switchHref, toRouterTarget } from "./locale.ts";

describe("recipe paths", () => {
  it("keeps Chinese URLs and treats en as the language, including without a slash", () => {
    expect(parseMounted("/recipes")?.lang).toBe("zh");
    expect(parseMounted("/recipes/12")?.route).toEqual({ kind: "detail", id: "12" });
    expect(parseMounted("/recipes/en")).toMatchObject({ lang: "en", rest: "", route: { kind: "home" } });
    expect(parseMounted("/recipes/en/")).toMatchObject({ lang: "en", rest: "" });
    expect(parseMounted("/recipes/en/12")).toMatchObject({ lang: "en", route: { kind: "detail", id: "12" } });
    expect(parseMounted("/recipes/en/12/edit")?.route).toEqual({ kind: "edit", id: "12" });
    expect(parseMounted("/recipes/english")?.lang).toBe("zh");
    expect(parseMounted("/recipes/api/recipes")).toMatchObject({ lang: "zh", route: { kind: "other" } });
    expect(parseRouter("/en")).toMatchObject({ lang: "en", bare: "/" });
    expect(parseRouter("/en/")).toMatchObject({ lang: "en", bare: "/" });
    expect(parseRouter("/english")).toMatchObject({ lang: "zh", bare: "/english" });
    expect(parseRouter("/12")).toMatchObject({ lang: "zh", bare: "/12" });
  });

  it("keeps the query and hash and marks explicit Chinese", () => {
    expect(switchHref("/recipes/en/12", "?a=1", "#x", "zh")).toBe("/recipes/12?a=1&lang=zh#x");
    expect(switchHref("/recipes/12", "?a=1&lang=zh", "#x", "en")).toBe("/recipes/en/12?a=1#x");
    expect(switchHref("/", "?q=1", "#a", "en")).toBe("/recipes/en/?q=1#a");
    expect(switchHref("/en/", "", "", "zh")).toBe("/recipes/?lang=zh");
    expect(toRouterTarget("/recipes/en/12?a=1#x")).toBe("/en/12?a=1#x");
    expect(toRouterTarget("/recipes/?lang=zh#a")).toBe("/?lang=zh#a");
  });
});
