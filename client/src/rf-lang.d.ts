export {};

declare global {
  interface Window {
    rfLang?: {
      v: number;
      leaving: boolean;
      place(pathname: string): { site: { id: string; base: string; en: boolean }; lang: "zh" | "en"; rest: string };
      href(lang: "zh" | "en"): string;
      choose(lang: "zh" | "en"): boolean;
      offers(lang: "zh" | "en"): boolean;
      siteHref(id: string): string;
      pref(): "zh" | "en" | null;
      match(tags: readonly unknown[]): "zh" | "en" | null;
      enter(): void;
    };
    __rfBar?: number;
  }
}
