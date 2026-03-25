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

export function getAll({ search, category } = {}) {
  let sql = "SELECT * FROM entries";
  const conditions = [];
  const params = {};

  if (category && category !== "all") {
    conditions.push("category = @category");
    params.category = category;
  }
  if (search) {
    conditions.push("(name LIKE @search OR tags LIKE @search)");
    params.search = `%${search}%`;
  }

  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY name COLLATE NOCASE ASC";

  const rows = db.prepare(sql).all(params);
  return rows.map(decryptEntry);
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

export function count() {
  return db.prepare("SELECT COUNT(*) as count FROM entries").get().count;
}
