import db from "./db.js";
import { encrypt, decrypt } from "./crypto.js";

function encryptEntry(data) {
  return {
    ...data,
    username: encrypt(data.username),
    secret: encrypt(data.secret),
    url: encrypt(data.url),
    notes: encrypt(data.notes),
  };
}

function decryptEntry(row) {
  if (!row) return null;
  return {
    ...row,
    username: decrypt(row.username),
    secret: decrypt(row.secret),
    url: decrypt(row.url),
    notes: decrypt(row.notes),
  };
}

const SORT_MAP = {
  "name-asc": "pinned DESC, name COLLATE NOCASE ASC",
  "name-desc": "pinned DESC, name COLLATE NOCASE DESC",
  "created": "pinned DESC, createdAt DESC",
  "updated": "pinned DESC, updatedAt DESC",
  "accessed": "pinned DESC, lastAccessedAt DESC",
};

export function getAll({ search, category, sort } = {}) {
  let sql = "SELECT * FROM entries";
  const conditions = [];
  const params = {};

  if (category === "recent") {
    conditions.push("lastAccessedAt IS NOT NULL");
  } else if (category && category !== "all") {
    conditions.push("category = @category");
    params.category = category;
  }
  if (search) {
    conditions.push("(name LIKE @search OR tags LIKE @search)");
    params.search = `%${search}%`;
  }

  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");

  if (category === "recent") {
    sql += " ORDER BY lastAccessedAt DESC LIMIT 20";
  } else {
    sql += ` ORDER BY ${SORT_MAP[sort] || SORT_MAP["name-asc"]}`;
  }

  const rows = db.prepare(sql).all(params);
  return rows.map(decryptEntry);
}

export function getAllMeta({ search } = {}) {
  let sql = "SELECT id, name, category, type, tags, pinned FROM entries";
  if (search) {
    sql += " WHERE (name LIKE @search OR tags LIKE @search)";
  }
  sql += " ORDER BY pinned DESC, name COLLATE NOCASE ASC";
  return db.prepare(sql).all(search ? { search: `%${search}%` } : {});
}

export function getById(id) {
  const row = db.prepare("SELECT * FROM entries WHERE id = ?").get(id);
  return decryptEntry(row);
}

export function create(data) {
  const enc = encryptEntry(data);
  const stmt = db.prepare(`INSERT INTO entries (name, category, type, username, secret, url, notes, tags)
    VALUES (@name, @category, @type, @username, @secret, @url, @notes, @tags)`);
  const result = stmt.run(enc);
  return result.lastInsertRowid;
}

export function update(id, data) {
  const enc = encryptEntry(data);
  db.prepare(`UPDATE entries SET name = @name, category = @category, type = @type,
    username = @username, secret = @secret, url = @url, notes = @notes, tags = @tags,
    updatedAt = datetime('now') WHERE id = @id`).run({ ...enc, id });
}

export function remove(id) {
  db.prepare("DELETE FROM entries WHERE id = ?").run(id);
}

export function getAllRaw() {
  return db.prepare("SELECT * FROM entries ORDER BY name COLLATE NOCASE ASC").all();
}

export function importEntries(entries) {
  const stmt = db.prepare(`INSERT INTO entries (name, category, type, username, secret, url, notes, tags)
    VALUES (@name, @category, @type, @username, @secret, @url, @notes, @tags)`);
  const tx = db.transaction((items) => {
    for (const item of items) stmt.run(item);
  });
  tx(entries);
}

export function bulkCreate(entries) {
  const stmt = db.prepare(`INSERT INTO entries (name, category, type, username, secret, url, notes, tags)
    VALUES (@name, @category, @type, @username, @secret, @url, @notes, @tags)`);
  const tx = db.transaction((items) => {
    for (const item of items) {
      const enc = encryptEntry(item);
      stmt.run(enc);
    }
  });
  tx(entries);
  return entries.length;
}

export function count() {
  return db.prepare("SELECT COUNT(*) as count FROM entries").get().count;
}

export function togglePin(id) {
  db.prepare("UPDATE entries SET pinned = NOT pinned WHERE id = ?").run(id);
  return db.prepare("SELECT pinned FROM entries WHERE id = ?").get(id)?.pinned;
}

export function touch(id) {
  db.prepare("UPDATE entries SET lastAccessedAt = datetime('now') WHERE id = ?").run(id);
}
