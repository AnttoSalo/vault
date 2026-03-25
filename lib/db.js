import Database from "better-sqlite3";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.VAULT_DB_PATH || join(__dirname, "..", "data", "vault.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  type TEXT NOT NULL DEFAULT 'password',
  username TEXT,
  secret TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  tags TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// Migrations (idempotent)
try { db.exec("ALTER TABLE entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE entries ADD COLUMN lastAccessedAt TEXT"); } catch (_) {}

process.on("exit", () => db.close());

export default db;
