import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function openDatabase(file: string): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      douyin_url TEXT,
      ingredients TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS images (
      key TEXT PRIMARY KEY,
      recipe_id INTEGER,
      position INTEGER NOT NULL,
      filename TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `);
  return db;
}
