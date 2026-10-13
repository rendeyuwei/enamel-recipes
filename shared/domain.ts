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

export type FieldError = { field: FieldName; message: string };

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

function fail(fields: FieldError[]): { ok: false; error: string; fields: FieldError[] } {
  return { ok: false, error: fields[0]?.message ?? "请求格式不对", fields };
}

function linesOf(value: unknown, field: FieldName, emptyMessage: string, max: number, maxMessage: string): string[] | FieldError {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return { field, message: "请求格式不对" };
  }
  const lines = value.map((item) => item.trim()).filter(Boolean);
  if (lines.length === 0) return { field, message: emptyMessage };
  if (lines.length > max) return { field, message: maxMessage };
  if (lines.some((line) => [...line].length > 300)) return { field, message: "这一行太长了" };
  return lines;
}

export function validateWrite(input: unknown): { ok: true; value: NormalizedWrite } | { ok: false; error: string; fields: FieldError[] } {
  if (!input || typeof input !== "object") return fail([{ field: "title", message: "请求格式不对" }]);
  const body = input as Record<string, unknown>;
  const fields: FieldError[] = [];

  const titleRaw = typeof body.title === "string" ? body.title.replace(/[\r\n]+/g, " ").trim() : "";
  if (!titleRaw) fields.push({ field: "title", message: "请填写菜名" });
  else if ([...titleRaw].length > 60) fields.push({ field: "title", message: "菜名最多 60 个字" });

  let douyinUrl: string | null = null;
  const douyinRaw = typeof body.douyinUrl === "string" ? body.douyinUrl.trim() : "";
  if (typeof body.douyinUrl !== "string") fields.push({ field: "douyinUrl", message: "请求格式不对" });
  else if (douyinRaw) {
    try {
      const url = new URL(douyinRaw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        fields.push({ field: "douyinUrl", message: "抖音链接要是 http 或 https 网址" });
      } else if (douyinRaw.length > 500) {
        fields.push({ field: "douyinUrl", message: "抖音链接太长了" });
      } else {
        douyinUrl = url.toString();
      }
    } catch {
      fields.push({ field: "douyinUrl", message: "抖音链接要是 http 或 https 网址" });
    }
  }

  const ingredientLines = linesOf(body.ingredientLines, "ingredients", "至少写一种食材", 40, "最多 40 种食材");
  const ingredients = Array.isArray(ingredientLines)
    ? ingredientLines.map((line) => parseIngredientLine(line)).filter((item): item is Ingredient => item !== null)
    : [];
  if (!Array.isArray(ingredientLines)) fields.push(ingredientLines);

  const stepLines = linesOf(body.stepLines, "steps", "至少写一步", 40, "最多 40 步");
  if (!Array.isArray(stepLines)) fields.push(stepLines);

  let imageKeys: string[] = [];
  if (!Array.isArray(body.imageKeys) || body.imageKeys.some((item) => typeof item !== "string")) {
    fields.push({ field: "images", message: "请求格式不对" });
  } else if (body.imageKeys.length > MAX_IMAGES) {
    fields.push({ field: "images", message: "一道菜最多 8 张截图" });
  } else if (body.imageKeys.some((key) => !IMAGE_KEY.test(key))) {
    fields.push({ field: "images", message: "截图无效" });
  } else if (new Set(body.imageKeys).size !== body.imageKeys.length) {
    fields.push({ field: "images", message: "截图重复了" });
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
