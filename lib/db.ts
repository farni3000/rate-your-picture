import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const THUMBNAILS_DIR = path.join(DATA_DIR, "thumbnails");
const DB_PATH = path.join(DATA_DIR, "ryp.db");

export interface StoredEntry {
  id: string;
  name: string;
  score: number;
  verdict: string;
  imgExt: string;
  imgHash: string;
  resultJson: string;
  createdAt: string;
}

type Row = {
  id: string;
  name: string;
  score: number;
  verdict: string;
  img_ext: string;
  img_hash: string;
  result_json: string;
  created_at: string;
};

function toEntry(row: Row): StoredEntry {
  return {
    id: row.id,
    name: row.name,
    score: row.score,
    verdict: row.verdict,
    imgExt: row.img_ext,
    imgHash: row.img_hash,
    resultJson: row.result_json,
    createdAt: row.created_at,
  };
}

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      score REAL NOT NULL,
      verdict TEXT NOT NULL DEFAULT '',
      img_ext TEXT NOT NULL DEFAULT 'jpg',
      img_hash TEXT NOT NULL DEFAULT '',
      result_json TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  const cols = db
    .prepare("PRAGMA table_info(leaderboard)")
    .all() as unknown as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  if (!have.has("img_hash")) {
    db.exec("ALTER TABLE leaderboard ADD COLUMN img_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!have.has("result_json")) {
    db.exec("ALTER TABLE leaderboard ADD COLUMN result_json TEXT NOT NULL DEFAULT ''");
  }
  return db;
}

export function saveThumbnail(id: string, ext: string, buffer: Buffer): void {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(/* turbopackIgnore: true */ THUMBNAILS_DIR, `${id}.${ext}`),
    buffer,
  );
}

export function insertRating(entry: StoredEntry): void {
  const st = getDb().prepare(
    `INSERT INTO leaderboard (id, name, score, verdict, img_ext, img_hash, result_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  st.run(
    entry.id,
    entry.name,
    entry.score,
    entry.verdict,
    entry.imgExt,
    entry.imgHash,
    entry.resultJson,
    entry.createdAt,
  );
}

export function findByHash(imgHash: string): StoredEntry | undefined {
  const row = getDb()
    .prepare(
      `SELECT id, name, score, verdict, img_ext, img_hash, result_json, created_at
       FROM leaderboard WHERE img_hash = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(imgHash) as Row | undefined;
  return row ? toEntry(row) : undefined;
}

export function countRatings(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM leaderboard").get() as {
    n: number;
  };
  return row.n;
}

function rankOf(id: string, score: number, createdAt: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM leaderboard
       WHERE score > ? OR (score = ? AND created_at > ?) OR (score = ? AND created_at = ? AND id < ?)`,
    )
    .get(score, score, createdAt, score, createdAt, id) as { n: number };
  return row.n + 1;
}

export function rankFor(entry: StoredEntry): number {
  return rankOf(entry.id, entry.score, entry.createdAt);
}

export function topRatings(limit: number): StoredEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, score, verdict, img_ext, img_hash, result_json, created_at
       FROM leaderboard
       ORDER BY score DESC, created_at DESC, id ASC
       LIMIT ?`,
    )
    .all(limit) as unknown as Row[];
  return rows.map(toEntry);
}

export function getRating(id: string): StoredEntry | undefined {
  const row = getDb()
    .prepare(
      `SELECT id, name, score, verdict, img_ext, img_hash, result_json, created_at
       FROM leaderboard WHERE id = ?`,
    )
    .get(id) as Row | undefined;
  return row ? toEntry(row) : undefined;
}
