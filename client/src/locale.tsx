import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseRouter, routerPath, switchHref, toRouterTarget, type Lang, type RecipeRoute } from "../../shared/locale.ts";

export type LocaleValue = {
  lang: Lang;
  route: RecipeRoute;
  bare: string;
  pathname: string;
  search: string;
  hash: string;
  href: (to: string) => string;
};

const LocaleContext = createContext<LocaleValue | null>(null);

function buildLocale(pathname: string, search: string, hash: string): LocaleValue {
  const place = parseRouter(pathname);
  return {
    lang: place.lang,
    route: place.route,
    bare: place.bare,
    pathname,
    search,
    hash,
    href(to: string) {
      const hashAt = to.indexOf("#");
      const hashPart = hashAt >= 0 ? to.slice(hashAt) : "";
      const before = hashAt >= 0 ? to.slice(0, hashAt) : to;
      const queryAt = before.indexOf("?");
      const query = queryAt >= 0 ? before.slice(queryAt) : "";
      const path = queryAt >= 0 ? before.slice(0, queryAt) : before;
      const bare = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
      return routerPath(place.lang, bare) + query + hashPart;
    },
  };
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const value = useMemo(
    () => buildLocale(location.pathname, location.search, location.hash),
    [location.pathname, location.search, location.hash],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const provided = useContext(LocaleContext);
  const location = useLocation();
  if (provided) return provided;
  return buildLocale(location.pathname, location.search, location.hash);
}

export function LocaleBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    const link = document.querySelector<HTMLAnchorElement>("a.rf-lang");
    if (!link) return;
    const current = locationRef.current;
    const next: Lang = parseRouter(current.pathname).lang === "en" ? "zh" : "en";
    link.href = switchHref(current.pathname, current.search, current.hash, next);
  });

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const raw = event.target;
      if (!(raw instanceof Element)) return;
      const link = raw.closest("a.rf-lang");
      if (!(link instanceof HTMLAnchorElement)) return;
      const current = locationRef.current;
      const next: Lang = parseRouter(current.pathname).lang === "en" ? "zh" : "en";
      const full = switchHref(current.pathname, current.search, current.hash, next);
      link.href = full;
      event.preventDefault();
      navigate(toRouterTarget(full));
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [navigate]);

  return null;
}
