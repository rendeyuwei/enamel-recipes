import type { Lang } from "./locale.ts";

export const ERROR_CODES = [
  "auth.required",
  "auth.invalid",
  "auth.rate",
  "write.rate",
  "recipe.missing",
  "upload.missing",
  "upload.unknown",
  "upload.attached",
  "upload.foreign",
  "upload.empty",
  "upload.type",
  "upload.too_large",
  "upload.invalid",
  "request.bad",
  "file.missing",
  "route.missing",
  "server.error",
  "client.fallback",
  "field.fallback",
  "title.required",
  "title.too_long",
  "douyin.url",
  "douyin.too_long",
  "ingredients.required",
  "ingredients.too_many",
  "line.too_long",
  "steps.required",
  "steps.too_many",
  "images.too_many",
  "images.duplicate",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const ZH: Record<ErrorCode, string> = {
  "auth.required": "请先登录",
  "auth.invalid": "账号或密码不对，再试一次。",
  "auth.rate": "试得太勤了，等一会儿再登录。",
  "write.rate": "写得太勤了，等一会儿再试。",
  "recipe.missing": "没有这道菜",
  "upload.missing": "没有这张截图",
  "upload.unknown": "找不到这张截图",
  "upload.attached": "这张图还在菜谱上",
  "upload.foreign": "这张截图属于另一道菜",
  "upload.empty": "没有收到图片",
  "upload.type": "只能上传 JPEG、PNG 或 WebP",
  "upload.too_large": "单张图片不能超过 2MB",
  "upload.invalid": "截图无效",
  "request.bad": "请求格式不对",
  "file.missing": "没有这个文件",
  "route.missing": "没有这个地址",
  "server.error": "服务器出错了",
  "client.fallback": "请求失败",
  "field.fallback": "这里需要改一下",
  "title.required": "请填写菜名",
  "title.too_long": "菜名最多 60 个字",
  "douyin.url": "抖音链接要是 http 或 https 网址",
  "douyin.too_long": "抖音链接太长了",
  "ingredients.required": "至少写一种食材",
  "ingredients.too_many": "最多 40 种食材",
  "line.too_long": "这一行太长了",
  "steps.required": "至少写一步",
  "steps.too_many": "最多 40 步",
  "images.too_many": "一道菜最多 8 张截图",
  "images.duplicate": "截图重复了",
};

const EN: Record<ErrorCode, string> = {
  "auth.required": "Log in first.",
  "auth.invalid": "Wrong username or password. Try again.",
  "auth.rate": "Too many attempts. Wait and try logging in again.",
  "write.rate": "Too many changes. Wait and try again.",
  "recipe.missing": "That recipe isn't here.",
  "upload.missing": "That photo isn't here.",
  "upload.unknown": "That photo can't be found.",
  "upload.attached": "That photo is still on a recipe.",
  "upload.foreign": "That photo belongs to another recipe.",
  "upload.empty": "No photo was received.",
  "upload.type": "Only JPEG, PNG, or WebP photos can be uploaded.",
  "upload.too_large": "Each photo must be 2MB or smaller.",
  "upload.invalid": "That photo isn't valid.",
  "request.bad": "That request isn't valid.",
  "file.missing": "That file isn't here.",
  "route.missing": "That address isn't here.",
  "server.error": "Something went wrong on the server.",
  "client.fallback": "Something went wrong.",
  "field.fallback": "Check this field.",
  "title.required": "Enter a dish name.",
  "title.too_long": "A dish name can be at most 60 characters.",
  "douyin.url": "The Douyin link must be an http or https URL.",
  "douyin.too_long": "That Douyin link is too long.",
  "ingredients.required": "Add at least one ingredient.",
  "ingredients.too_many": "At most 40 ingredients.",
  "line.too_long": "That line is too long.",
  "steps.required": "Add at least one step.",
  "steps.too_many": "At most 40 steps.",
  "images.too_many": "A recipe can have at most 8 photos.",
  "images.duplicate": "A photo is listed more than once.",
};

const TEXT: Record<Lang, Record<ErrorCode, string>> = { zh: ZH, en: EN };

export function isErrorCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ZH, code);
}

export function zhError(code: ErrorCode): string {
  return ZH[code];
}

export function errorText(lang: Lang, code: string): string | null {
  if (!isErrorCode(code)) return null;
  return TEXT[lang][code];
}

function technical(message: string): boolean {
  return /[\r\n]|exception|stack|\/[a-z0-9._-]+\.(?:ts|js)\b|\bat\s+\S+\s+\(/i.test(message);
}

export function localizeError(
  lang: Lang,
  code: string | undefined,
  serverMessage: string | undefined,
  kind: "form" | "field",
): string {
  if (code) {
    const known = errorText(lang, code);
    if (known) return known;
  }
  if (lang === "zh" && serverMessage && !technical(serverMessage)) return serverMessage;
  return TEXT[lang][kind === "field" ? "field.fallback" : "client.fallback"];
}
