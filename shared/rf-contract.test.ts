import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { switchHref } from "./locale.ts";

type Api = {
  sites: { id: string; en: boolean }[];
  leaving: boolean;
  place(pathname: string): { site: { id: string }; lang: "zh" | "en"; rest: string };
  href(lang: "zh" | "en"): string;
  choose(lang: "zh" | "en"): boolean;
  siteHref(id: string): string;
  enter(): void;
};

const script = readFileSync(new URL("../client/vendor/rf-lang.js", import.meta.url), "utf8");

function boot(options: {
  href?: string;
  languages?: string[];
  language?: string;
  enter?: boolean;
  offers?: string[];
  blockStorage?: boolean;
  blockCookie?: boolean;
  pref?: "zh" | "en";
}) {
  const state = { href: options.href ?? "https://rende.fun/recipes/", replaced: "" };
  const mem = new Map<string, string>();
  if (options.pref) mem.set("rf-lang", options.pref);
  let cookie = "";
  const document = {
    get cookie() {
      if (options.blockCookie) throw new Error("cookie blocked");
      return cookie;
    },
    set cookie(value: string) {
      if (options.blockCookie) throw new Error("cookie blocked");
      cookie = value;
    },
    currentScript: options.enter ? { hasAttribute: (name: string) => name === "data-rf-enter" } : null,
    querySelector(selector: string) {
      return (options.offers ?? ["zh-CN", "en"]).some((lang) => selector.includes(`hreflang="${lang}"`)) ? {} : null;
    },
  };
  const localStorage = {
    getItem(key: string) {
      if (options.blockStorage) throw new Error("storage blocked");
      return mem.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.blockStorage) throw new Error("storage blocked");
      mem.set(key, value);
    },
  };
  const languages = options.languages ?? ["zh-CN"];
  const location = {
    get pathname() {
      return new URL(state.href).pathname;
    },
    get search() {
      return new URL(state.href).search;
    },
    get hash() {
      return new URL(state.href).hash;
    },
    get protocol() {
      return "https:";
    },
    replace(next: string) {
      state.replaced = next;
      state.href = new URL(next, state.href).href;
    },
  };
  const context = {
    window: {} as Record<string, unknown>,
    document,
    location,
    navigator: { languages, language: options.language ?? languages[0] ?? "" },
    localStorage,
  };
  context.window = context;
  vm.runInNewContext(script, context, { filename: "rf-lang.js" });
  return { api: context.window.rfLang as Api, state };
}

describe("vendored rfLang contract", () => {
  it("matches this site's language switch to the shared href", () => {
    const samples = [
      "https://rende.fun/recipes/",
      "https://rende.fun/recipes",
      "https://rende.fun/recipes/en",
      "https://rende.fun/recipes/en/",
      "https://rende.fun/recipes/en/12",
      "https://rende.fun/recipes/12?lang=zh#cook",
      "https://rende.fun/recipes/en/12/edit?a=1&lang=zh#x",
      "https://rende.fun/recipes/login?next=%2Fnew",
      "https://rende.fun/recipes/?freeze=0#about",
    ];
    for (const sample of samples) {
      const { api } = boot({ href: sample, enter: false });
      const url = new URL(sample);
      const next = api.place(url.pathname).lang === "en" ? "zh" : "en";
      expect(switchHref(url.pathname, url.search, url.hash, next)).toBe(api.href(next));
    }
  });

  it("follows the approved language order and does not loop", () => {
    expect(boot({ languages: ["en-US"], enter: true }).state.replaced).toBe("/recipes/en/");
    expect(boot({ languages: ["zh-CN"], enter: true }).state.replaced).toBe("");
    expect(boot({ languages: ["ja", "en", "zh-CN"], enter: true }).state.replaced).toBe("/recipes/en/");
    expect(boot({ languages: ["ja", "zh-TW", "en"], enter: true }).state.replaced).toBe("");
    expect(boot({ languages: ["ja", "ko"], language: "", enter: true }).state.replaced).toBe("/recipes/en/");
    expect(boot({ languages: [], language: "", enter: true }).state.replaced).toBe("/recipes/en/");
    expect(boot({ languages: ["en-US"], pref: "zh", enter: true }).state.replaced).toBe("");
    expect(boot({ languages: ["zh-CN"], pref: "en", enter: true }).state.replaced).toBe("/recipes/en/");
    expect(boot({ href: "https://rende.fun/recipes/en/12", languages: ["zh-CN"], pref: "zh", enter: true }).state.replaced).toBe("");
    expect(boot({ href: "https://rende.fun/recipes/?lang=zh", languages: ["en-US"], enter: true }).state.replaced).toBe("");
    expect(boot({ href: "https://rende.fun/recipes/?freeze=0#about", languages: ["en"], enter: true }).state.href).toBe(
      "https://rende.fun/recipes/en/?freeze=0#about",
    );
    expect(boot({ languages: ["en-US"], offers: ["zh-CN"], enter: true }).state.replaced).toBe("");
  });

  it("still switches when storage and cookies are blocked, and carries explicit Chinese", () => {
    const blocked = boot({ blockStorage: true, blockCookie: true, enter: false });
    expect(blocked.api.choose("zh")).toBe(false);
    expect(() => blocked.api.enter()).not.toThrow();
    const page = boot({
      href: "https://rende.fun/recipes/en/12?keep=1#dish",
      blockStorage: true,
      blockCookie: true,
      enter: false,
    });
    expect(page.api.href("zh")).toBe("/recipes/12?keep=1&lang=zh#dish");
    const explicit = boot({ href: "https://rende.fun/recipes/?lang=zh", blockStorage: true, blockCookie: true, enter: false });
    expect(explicit.api.siteHref("shutter")).toBe("/shutter/?lang=zh");
    expect(explicit.api.sites.find((site) => site.id === "recipes")?.en).toBe(false);
  });
});
