import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { COPY, pageTitle } from "../../shared/copy.ts";
import { PUBLIC_ORIGIN, canonicalPath, parseRouter } from "../../shared/locale.ts";

const TitleContext = createContext<(title: string | null | undefined) => void>(() => {});

export function RecipeTitleProvider({ children }: { children: ReactNode }) {
  const [detailTitle, setDetailTitle] = useState<string | null | undefined>(undefined);
  return (
    <TitleContext.Provider value={setDetailTitle}>
      <DocumentMeta detailTitle={detailTitle} />
      {children}
    </TitleContext.Provider>
  );
}

export function useRecipeTitle(title: string | null | undefined) {
  const set = useContext(TitleContext);
  useEffect(() => {
    set(title);
    return () => set(undefined);
  }, [set, title]);
}

function ensure(selector: string, create: () => HTMLElement): HTMLElement {
  const found = document.head.querySelector(selector);
  if (found instanceof HTMLElement) return found;
  const created = create();
  document.head.appendChild(created);
  return created;
}

function DocumentMeta({ detailTitle }: { detailTitle: string | null | undefined }) {
  const location = useLocation();
  useEffect(() => {
    const place = parseRouter(location.pathname);
    const lang = place.lang;
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    if (!(place.route.kind === "detail" && detailTitle === undefined)) {
      document.title = pageTitle(lang, place.route, detailTitle);
    }
    const description = ensure('meta[name="description"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      return meta;
    });
    description.setAttribute("content", COPY[lang].description);
    const canonical = ensure('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.rel = "canonical";
      return link;
    });
    canonical.setAttribute("href", `${PUBLIC_ORIGIN}${canonicalPath(lang, place.route)}`);
    const zh = `${PUBLIC_ORIGIN}${canonicalPath("zh", place.route)}`;
    const en = `${PUBLIC_ORIGIN}${canonicalPath("en", place.route)}`;
    for (const [hreflang, href] of [
      ["zh-CN", zh],
      ["en", en],
      ["x-default", en],
    ] as const) {
      const link = ensure(`link[rel="alternate"][hreflang="${hreflang}"]`, () => {
        const el = document.createElement("link");
        el.rel = "alternate";
        el.setAttribute("hreflang", hreflang);
        return el;
      });
      link.setAttribute("href", href);
    }
  }, [location.pathname, detailTitle]);
  return null;
}
