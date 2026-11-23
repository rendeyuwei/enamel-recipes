import { zhError, type ErrorCode } from "./errors.ts";

export type Ingredient = { name: string; amount: string };

export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

export type ImageRef = {
  key: string;
  filename: string;
  bytes: number;
  contentType: ImageContentType;
};

export type RecipeRecord = {
  id: number;
  title: string;
  douyinUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  images: ImageRef[];
  createdAt: string;
  updatedAt: string;
};

export type RecipeCard = {
  id: number;
  title: string;
  ingredients: Ingredient[];
  stepCount: number;
  coverKey: string | null;
  createdAt: string;
};

export type RecipeWrite = {
  title: string;
  douyinUrl: string;
  ingredientLines: string[];
  stepLines: string[];
  imageKeys: string[];
};

export type NormalizedWrite = {
  title: string;
  douyinUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  imageKeys: string[];
};

export type FieldName = "title" | "douyinUrl" | "ingredients" | "steps" | "images";

export type FieldError = { field: FieldName; code: ErrorCode; message: string };

export type SniffedImage = { contentType: ImageContentType; ext: ".jpg" | ".png" | ".webp" };

const TONES = ["red", "blue", "pale", "ink"] as const;
export type GlyphTone = (typeof TONES)[number];

const IMAGE_KEY = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES = 8;

export function parseIngredientLine(line: string): Ingredient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const splitAt = trimmed.search(/\s/);
  if (splitAt === -1) return { name: trimmed, amount: "" };
  return { name: trimmed.slice(0, splitAt), amount: trimmed.slice(splitAt).trim() };
}

export function sniffImage(buf: Uint8Array): SniffedImage | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: "image/jpeg", ext: ".jpg" };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { contentType: "image/png", ext: ".png" };
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { contentType: "image/webp", ext: ".webp" };
  }
  return null;
}

export function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\-\u4e00-\u9fff]+/g, "_").replace(/^\.+/, "").slice(0, 80);
  return cleaned || "image";
}

export function formatBytes(bytes: number): string {
  if (bytes >= 100 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function coverGlyph(title: string): { char: string; tone: GlyphTone } {
  const char = [...title.trim()][0] ?? "菜";
  const code = char.codePointAt(0) ?? 0;
  return { char, tone: TONES[code % TONES.length] ?? "red" };
}

export function shanghaiWeekStart(now: Date): Date {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const daysFromMonday = (shifted.getUTCDay() + 6) % 7;
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysFromMonday,
  );
  return new Date(startShifted - 8 * 60 * 60 * 1000);
}

export function isInShanghaiWeek(iso: string, now: Date): boolean {
  return new Date(iso).getTime() >= shanghaiWeekStart(now).getTime();
}

export function formatShanghaiDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function recipeMatches(
  recipe: { title: string; ingredients: Ingredient[] },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (recipe.title.toLowerCase().includes(needle)) return true;
  return recipe.ingredients.some((item) =>
    `${item.name} ${item.amount}`.toLowerCase().includes(needle),
  );
}

export function attachImages<T>(steps: string[], images: T[]): { text: string; images: T[] }[] {
  const grouped = steps.map((text) => ({ text, images: [] as T[] }));
  if (grouped.length === 0) return grouped;
  images.forEach((image, index) => {
    const at = Math.min(index, grouped.length - 1);
    grouped[at]?.images.push(image);
  });
  return grouped;
}

export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return "/";
  }
  return raw;
}

function fieldError(field: FieldName, code: ErrorCode): FieldError {
  return { field, code, message: zhError(code) };
}

function fail(fields: FieldError[]): { ok: false; error: string; code: ErrorCode; fields: FieldError[] } {
  const first = fields[0];
  return {
    ok: false,
    error: first?.message ?? zhError("request.bad"),
    code: first?.code ?? "request.bad",
    fields,
  };
}

function linesOf(
  value: unknown,
  field: FieldName,
  bad: ErrorCode,
  empty: ErrorCode,
  max: number,
  tooMany: ErrorCode,
): string[] | FieldError {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return fieldError(field, bad);
  const lines = value.map((item) => item.trim()).filter(Boolean);
  if (lines.length === 0) return fieldError(field, empty);
  if (lines.length > max) return fieldError(field, tooMany);
  if (lines.some((line) => [...line].length > 300)) return fieldError(field, "line.too_long");
  return lines;
}

export function validateWrite(
  input: unknown,
): { ok: true; value: NormalizedWrite } | { ok: false; error: string; code: ErrorCode; fields: FieldError[] } {
  if (!input || typeof input !== "object") return fail([fieldError("title", "request.bad")]);
  const body = input as Record<string, unknown>;
  const fields: FieldError[] = [];

  const titleRaw = typeof body.title === "string" ? body.title.replace(/[\r\n]+/g, " ").trim() : "";
  if (!titleRaw) fields.push(fieldError("title", "title.required"));
  else if ([...titleRaw].length > 60) fields.push(fieldError("title", "title.too_long"));

  let douyinUrl: string | null = null;
  const douyinRaw = typeof body.douyinUrl === "string" ? body.douyinUrl.trim() : "";
  if (typeof body.douyinUrl !== "string") fields.push(fieldError("douyinUrl", "request.bad"));
  else if (douyinRaw) {
    try {
      const url = new URL(douyinRaw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        fields.push(fieldError("douyinUrl", "douyin.url"));
      } else if (douyinRaw.length > 500) {
        fields.push(fieldError("douyinUrl", "douyin.too_long"));
      } else {
        douyinUrl = url.toString();
      }
    } catch {
      fields.push(fieldError("douyinUrl", "douyin.url"));
    }
  }

  const ingredientLines = linesOf(body.ingredientLines, "ingredients", "request.bad", "ingredients.required", 40, "ingredients.too_many");
  const ingredients = Array.isArray(ingredientLines)
    ? ingredientLines.map((line) => parseIngredientLine(line)).filter((item): item is Ingredient => item !== null)
    : [];
  if (!Array.isArray(ingredientLines)) fields.push(ingredientLines);

  const stepLines = linesOf(body.stepLines, "steps", "request.bad", "steps.required", 40, "steps.too_many");
  if (!Array.isArray(stepLines)) fields.push(stepLines);

  let imageKeys: string[] = [];
  if (!Array.isArray(body.imageKeys) || body.imageKeys.some((item) => typeof item !== "string")) {
    fields.push(fieldError("images", "request.bad"));
  } else if (body.imageKeys.length > MAX_IMAGES) {
    fields.push(fieldError("images", "images.too_many"));
  } else if (body.imageKeys.some((key) => !IMAGE_KEY.test(key))) {
    fields.push(fieldError("images", "upload.invalid"));
  } else if (new Set(body.imageKeys).size !== body.imageKeys.length) {
    fields.push(fieldError("images", "images.duplicate"));
  } else {
    imageKeys = body.imageKeys;
  }

  if (fields.length > 0) return fail(fields);
  return {
    ok: true,
    value: {
      title: titleRaw,
      douyinUrl,
      ingredients,
      steps: stepLines as string[],
      imageKeys,
    },
  };
}

export function toCard(recipe: RecipeRecord): RecipeCard {
  return {
    id: recipe.id,
    title: recipe.title,
    ingredients: recipe.ingredients,
    stepCount: recipe.steps.length,
    coverKey: recipe.images[0]?.key ?? null,
    createdAt: recipe.createdAt,
  };
}
