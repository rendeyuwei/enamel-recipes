export type Lang = "zh" | "en";

export const PUBLIC_ORIGIN = "https://rende.fun";
export const RECIPE_MOUNT = "/recipes";

export type RecipeRoute =
  | { kind: "home" }
  | { kind: "login" }
  | { kind: "new" }
  | { kind: "edit"; id: string }
  | { kind: "detail"; id: string }
  | { kind: "other" };

export type RecipePlace = {
  lang: Lang;
  rest: string;
  route: RecipeRoute;
};

const EDIT = /^(\d+)\/edit$/;
const DETAIL = /^(\d+)$/;

export function classifyRest(rest: string): RecipeRoute {
  if (rest === "") return { kind: "home" };
  if (rest === "login") return { kind: "login" };
  if (rest === "new") return { kind: "new" };
  const edit = EDIT.exec(rest);
  if (edit?.[1]) return { kind: "edit", id: edit[1] };
  const detail = DETAIL.exec(rest);
  if (detail?.[1]) return { kind: "detail", id: detail[1] };
  return { kind: "other" };
}

export function parseMounted(pathname: string): RecipePlace | null {
  const path = pathname || "/";
  if (path !== "/recipes" && path !== "/recipes/" && !path.startsWith("/recipes/")) return null;
  let rest = path === "/recipes" || path === "/recipes/" ? "" : path.slice("/recipes/".length);
  rest = rest.replace(/\/+$/, "");
  let lang: Lang = "zh";
  if (rest === "en") {
    lang = "en";
    rest = "";
  } else if (rest.startsWith("en/")) {
    lang = "en";
    rest = rest.slice(3).replace(/^\/+|\/+$/g, "");
  }
  return { lang, rest, route: classifyRest(rest) };
}

export function parseRouter(pathname: string): RecipePlace & { bare: string } {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  let lang: Lang = "zh";
  let bare = path;
  if (path === "/en" || path === "/en/") {
    lang = "en";
    bare = "/";
  } else if (path.startsWith("/en/")) {
    lang = "en";
    bare = path.slice(3);
    if (!bare.startsWith("/")) bare = `/${bare}`;
  }
  bare = bare.replace(/\/+$/, "") || "/";
  const rest = bare.replace(/^\/+/, "");
  return { lang, bare, rest, route: classifyRest(rest) };
}

export function publicPath(lang: Lang, rest: string): string {
  const clean = rest.replace(/^\/+|\/+$/g, "");
  if (lang === "en") return clean ? `/recipes/en/${clean}` : "/recipes/en/";
  return clean ? `/recipes/${clean}` : "/recipes/";
}

export function langQuery(search: string, zh: boolean): string {
  const parts = (search || "")
    .replace(/^\?/, "")
    .split("&")
    .filter((part) => part && part.split("=")[0] !== "lang");
  if (zh) parts.push("lang=zh");
  return parts.length ? `?${parts.join("&")}` : "";
}

export function mountFromRouter(pathname: string): string {
  if (pathname === "/" || pathname === "") return "/recipes/";
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/recipes${path}`;
}

export function switchHref(pathname: string, search: string, hash: string, to: Lang): string {
  const full = pathname === "/recipes" || pathname.startsWith("/recipes/") ? pathname : mountFromRouter(pathname);
  const rest = parseMounted(full)?.rest ?? "";
  const hashPart = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  return publicPath(to, rest) + langQuery(search, to === "zh") + hashPart;
}

export function toRouterTarget(absolute: string): string {
  const hashAt = absolute.indexOf("#");
  const hash = hashAt >= 0 ? absolute.slice(hashAt) : "";
  const before = hashAt >= 0 ? absolute.slice(0, hashAt) : absolute;
  const queryAt = before.indexOf("?");
  const search = queryAt >= 0 ? before.slice(queryAt) : "";
  let path = queryAt >= 0 ? before.slice(0, queryAt) : before;
  if (path === "/recipes" || path === "/recipes/") path = "/";
  else if (path.startsWith("/recipes/")) path = path.slice("/recipes".length) || "/";
  if (path === "") path = "/";
  return path + search + hash;
}

export function routerPath(lang: Lang, bare: string): string {
  const path = bare.startsWith("/") ? bare : `/${bare}`;
  const normalized = path.replace(/\/+$/, "") || "/";
  if (lang === "zh") return normalized;
  if (normalized === "/") return "/en/";
  return `/en${normalized}`;
}

export function canonicalPath(lang: Lang, route: RecipeRoute): string {
  if (route.kind === "home") return publicPath(lang, "");
  if (route.kind === "login") return publicPath(lang, "login");
  if (route.kind === "new") return publicPath(lang, "new");
  if (route.kind === "edit") return publicPath(lang, `${route.id}/edit`);
  if (route.kind === "detail") return publicPath(lang, route.id);
  return publicPath(lang, "");
}
