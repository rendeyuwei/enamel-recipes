import type Database from "better-sqlite3";
import {
  isInShanghaiWeek,
  recipeMatches,
  toCard,
  type ImageContentType,
  type ImageRef,
  type NormalizedWrite,
  type RecipeCard,
  type RecipeRecord,
} from "../../shared/domain.ts";

type RecipeRow = {
  id: number;
  title: string;
  douyin_url: string | null;
  ingredients: string;
  steps: string;
  created_at: string;
  updated_at: string;
};

type ImageRow = {
  key: string;
  recipe_id: number | null;
  position: number;
  filename: string;
  bytes: number;
  content_type: string;
  created_at: string;
};

export type SaveResult =
  | { ok: true; recipe: RecipeRecord; removedKeys: string[] }
  | { ok: false; status: 400 | 404; error: string };

function contentType(value: string): ImageContentType {
  if (value === "image/jpeg" || value === "image/png" || value === "image/webp") return value;
  throw new Error(`unknown image content type: ${value}`);
}

function toImage(row: ImageRow): ImageRef {
  return {
    key: row.key,
    filename: row.filename,
    bytes: row.bytes,
    contentType: contentType(row.content_type),
  };
}

export function createRepo(db: Database.Database) {
  const recipeById = db.prepare("SELECT * FROM recipes WHERE id = ?");
  const imagesByRecipe = db.prepare(
    "SELECT * FROM images WHERE recipe_id = ? ORDER BY position ASC, key ASC",
  );
  const imageByKey = db.prepare("SELECT * FROM images WHERE key = ?");

  function imagesOf(recipeId: number): ImageRef[] {
    return (imagesByRecipe.all(recipeId) as ImageRow[]).map(toImage);
  }

  function read(row: RecipeRow): RecipeRecord {
    return {
      id: row.id,
      title: row.title,
      douyinUrl: row.douyin_url,
      ingredients: JSON.parse(row.ingredients) as RecipeRecord["ingredients"],
      steps: JSON.parse(row.steps) as string[],
      images: imagesOf(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function get(id: number): RecipeRecord | null {
    const row = recipeById.get(id) as RecipeRow | undefined;
    return row ? read(row) : null;
  }

  function resolveImages(keys: string[], selfId: number | null): { ok: true; images: ImageRef[] } | { ok: false; error: string } {
    const images: ImageRef[] = [];
    for (const key of keys) {
      const row = imageByKey.get(key) as ImageRow | undefined;
      if (!row) return { ok: false, error: "找不到这张截图" };
      if (row.recipe_id !== null && row.recipe_id !== selfId) return { ok: false, error: "这张截图属于另一道菜" };
      images.push(toImage(row));
    }
    return { ok: true, images };
  }

  const insertRecipe = db.prepare(
    `INSERT INTO recipes (title, douyin_url, ingredients, steps, created_at, updated_at)
     VALUES (@title, @douyinUrl, @ingredients, @steps, @createdAt, @updatedAt)`,
  );
  const updateRecipe = db.prepare(
    `UPDATE recipes
     SET title = @title, douyin_url = @douyinUrl, ingredients = @ingredients, steps = @steps, updated_at = @updatedAt
     WHERE id = @id`,
  );
  const attach = db.prepare("UPDATE images SET recipe_id = ?, position = ? WHERE key = ?");
  const deleteImage = db.prepare("DELETE FROM images WHERE key = ?");
  const insertImage = db.prepare(
    `INSERT INTO images (key, recipe_id, position, filename, bytes, content_type, created_at)
     VALUES (@key, NULL, 0, @filename, @bytes, @contentType, @createdAt)`,
  );

  function writeRecipe(id: number | null, write: NormalizedWrite, createdAt: string, updatedAt: string): SaveResult {
    const resolved = resolveImages(write.imageKeys, id);
    if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };
    const previous = id === null ? [] : imagesOf(id).map((image) => image.key);
    const removedKeys = previous.filter((key) => !write.imageKeys.includes(key));
    const fields = {
      title: write.title,
      douyinUrl: write.douyinUrl,
      ingredients: JSON.stringify(write.ingredients),
      steps: JSON.stringify(write.steps),
      createdAt,
      updatedAt,
    };
    const savedId = db.transaction(() => {
      let recipeId = id;
      if (recipeId === null) {
        const info = insertRecipe.run(fields);
        recipeId = Number(info.lastInsertRowid);
      } else {
        updateRecipe.run({
          id: recipeId,
          title: fields.title,
          douyinUrl: fields.douyinUrl,
          ingredients: fields.ingredients,
          steps: fields.steps,
          updatedAt: fields.updatedAt,
        });
      }
      for (const key of removedKeys) deleteImage.run(key);
      write.imageKeys.forEach((key, position) => attach.run(recipeId, position, key));
      return recipeId;
    })();
    const recipe = get(savedId);
    if (!recipe) return { ok: false, status: 404, error: "没有这道菜" };
    return { ok: true, recipe, removedKeys };
  }

  return {
    get,
    countRecipes(): number {
      const row = db.prepare("SELECT COUNT(*) AS n FROM recipes").get() as { n: number };
      return row.n;
    },
    list(q: string, now: Date): { total: number; addedThisWeek: number; recipes: RecipeCard[] } {
      const rows = db.prepare("SELECT * FROM recipes ORDER BY updated_at DESC, id DESC").all() as RecipeRow[];
      const recipes = rows.map(read);
      return {
        total: recipes.length,
        addedThisWeek: recipes.filter((recipe) => isInShanghaiWeek(recipe.createdAt, now)).length,
        recipes: recipes.filter((recipe) => recipeMatches(recipe, q)).map(toCard),
      };
    },
    create(write: NormalizedWrite, createdAt: string, updatedAt = createdAt): SaveResult {
      return writeRecipe(null, write, createdAt, updatedAt);
    },
    update(id: number, write: NormalizedWrite, updatedAt: string): SaveResult {
      if (!get(id)) return { ok: false, status: 404, error: "没有这道菜" };
      const existing = get(id);
      return writeRecipe(id, write, existing?.createdAt ?? updatedAt, updatedAt);
    },
    remove(id: number): string[] | null {
      const existing = get(id);
      if (!existing) return null;
      const keys = existing.images.map((image) => image.key);
      db.transaction(() => {
        db.prepare("DELETE FROM images WHERE recipe_id = ?").run(id);
        db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
      })();
      return keys;
    },
    addImage(image: ImageRef & { createdAt: string }) {
      insertImage.run(image);
    },
    image(key: string): (ImageRef & { recipeId: number | null }) | null {
      const row = imageByKey.get(key) as ImageRow | undefined;
      if (!row) return null;
      return { ...toImage(row), recipeId: row.recipe_id };
    },
    deletePending(key: string): "deleted" | "attached" | "missing" {
      const row = imageByKey.get(key) as ImageRow | undefined;
      if (!row) return "missing";
      if (row.recipe_id !== null) return "attached";
      deleteImage.run(key);
      return "deleted";
    },
    sweepPending(cutoffIso: string): string[] {
      const rows = db
        .prepare("SELECT key FROM images WHERE recipe_id IS NULL AND created_at < ?")
        .all(cutoffIso) as { key: string }[];
      const keys = rows.map((row) => row.key);
      const drop = db.prepare("DELETE FROM images WHERE key = ? AND recipe_id IS NULL");
      db.transaction(() => {
        for (const key of keys) drop.run(key);
      })();
      return keys;
    },
    createSession(id: string, expiresAt: number) {
      db.prepare("INSERT INTO sessions (id, expires_at) VALUES (?, ?)").run(id, expiresAt);
    },
    validSession(id: string, nowMs: number): boolean {
      const row = db.prepare("SELECT expires_at FROM sessions WHERE id = ?").get(id) as { expires_at: number } | undefined;
      if (!row) return false;
      if (row.expires_at <= nowMs) {
        db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
        return false;
      }
      return true;
    },
    deleteSession(id: string) {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
