import { COPY, pageTitle } from "./copy.ts";
import { PUBLIC_ORIGIN, canonicalPath, parseMounted, type Lang } from "./locale.ts";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return "&quot;";
  });
}

function replaceTag(html: string, pattern: RegExp, value: string): string {
  return html.replace(pattern, (_match, start: string, end: string) => `${start}${escapeHtml(value)}${end}`);
}

export function renderRecipeHtml(html: string, urlPath: string, detailTitle?: string | null): string {
  const pathOnly = urlPath.split(/[?#]/, 1)[0] ?? urlPath;
  const place = parseMounted(pathOnly) ?? { lang: "zh" as Lang, rest: "", route: { kind: "home" as const } };
  const lang = place.lang;
  const title = pageTitle(lang, place.route, detailTitle);
  const description = COPY[lang].description;
  const self = `${PUBLIC_ORIGIN}${canonicalPath(lang, place.route)}`;
  const zh = `${PUBLIC_ORIGIN}${canonicalPath("zh", place.route)}`;
  const en = `${PUBLIC_ORIGIN}${canonicalPath("en", place.route)}`;
  let out = html.replace(/<html lang="[^"]*">/, `<html lang="${lang === "en" ? "en" : "zh-CN"}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  out = replaceTag(out, /(<meta name="description" content=")[^"]*(")/, description);
  out = replaceTag(out, /(<link rel="canonical" href=")[^"]*(")/, self);
  out = replaceTag(out, /(<link rel="alternate" hreflang="zh-CN" href=")[^"]*(")/, zh);
  out = replaceTag(out, /(<link rel="alternate" hreflang="en" href=")[^"]*(")/, en);
  out = replaceTag(out, /(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/, en);
  if (lang === "en") {
    out = out.replace(/<script\b[^>]*>/gi, (tag) => tag.replace(/\sdata-rf-enter\b/gi, ""));
  }
  return out;
}

export function deriveEnglishShell(html: string): string {
  return renderRecipeHtml(html, "/recipes/en/", undefined);
}
