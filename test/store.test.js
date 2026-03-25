import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { unlinkSync } from "fs";
import { tmpdir } from "os";

// Set up test environment before importing modules
const testDb = join(tmpdir(), `vault-test-${Date.now()}.db`);
process.env.VAULT_DB_PATH = testDb;
process.env.VAULT_KEY = "test-key-for-store-tests";

const store = await import("../lib/store.js");

after(() => {
  try { unlinkSync(testDb); } catch {}
  try { unlinkSync(testDb + "-wal"); } catch {}
  try { unlinkSync(testDb + "-shm"); } catch {}
});

const sample = {
  name: "Test Entry",
  category: "server",
  type: "password",
  username: "admin",
  secret: "supersecret123",
  url: "https://example.com",
  notes: "test notes",
  tags: "test,demo",
};

describe("CRUD", () => {
  let entryId;

  it("creates an entry", () => {
    entryId = store.create(sample);
    assert.ok(entryId);
  });

  it("retrieves an entry by id", () => {
    const entry = store.getById(entryId);
    assert.equal(entry.name, sample.name);
    assert.equal(entry.username, sample.username);
    assert.equal(entry.secret, sample.secret);
    assert.equal(entry.url, sample.url);
    assert.equal(entry.notes, sample.notes);
    assert.equal(entry.category, sample.category);
    assert.equal(entry.type, sample.type);
  });

  it("updates an entry", () => {
    store.update(entryId, { ...sample, name: "Updated Entry", secret: "new-secret" });
    const entry = store.getById(entryId);
    assert.equal(entry.name, "Updated Entry");
    assert.equal(entry.secret, "new-secret");
  });

  it("returns null for non-existent id", () => {
    assert.equal(store.getById(99999), null);
  });

  it("removes an entry", () => {
    store.remove(entryId);
    assert.equal(store.getById(entryId), null);
  });
});

describe("getAll", () => {
  let ids = [];

  before(() => {
    ids.push(store.create({ ...sample, name: "Alpha", category: "server", tags: "prod" }));
    ids.push(store.create({ ...sample, name: "Beta", category: "personal", tags: "dev" }));
    ids.push(store.create({ ...sample, name: "Charlie", category: "server", tags: "prod" }));
  });

  after(() => { ids.forEach((id) => store.remove(id)); });

  it("returns all entries", () => {
    const all = store.getAll();
    assert.ok(all.length >= 3);
  });

  it("filters by category", () => {
    const servers = store.getAll({ category: "server" });
    assert.ok(servers.every((e) => e.category === "server"));
  });

  it("searches by name", () => {
    const results = store.getAll({ search: "Alpha" });
    assert.ok(results.some((e) => e.name === "Alpha"));
    assert.ok(!results.some((e) => e.name === "Beta"));
  });

  it("searches by tags", () => {
    const results = store.getAll({ search: "prod" });
    assert.ok(results.length >= 2);
  });

  it("sorts by name descending", () => {
    const results = store.getAll({ sort: "name-desc" });
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].name.toLowerCase() >= results[i].name.toLowerCase());
    }
  });
});

describe("pin and touch", () => {
  let id;

  before(() => { id = store.create(sample); });
  after(() => { store.remove(id); });

  it("toggles pin", () => {
    const pinned = store.togglePin(id);
    assert.equal(pinned, 1);
    const unpinned = store.togglePin(id);
    assert.equal(unpinned, 0);
  });

  it("updates lastAccessedAt on touch", () => {
    store.touch(id);
    const entry = store.getById(id);
    assert.ok(entry.lastAccessedAt);
  });

  it("shows touched entries in recent", () => {
    store.touch(id);
    const recent = store.getAll({ category: "recent" });
    assert.ok(recent.some((e) => e.id === id));
  });
});

describe("bulk operations", () => {
  it("bulkCreate inserts multiple entries", () => {
    const before = store.count();
    store.bulkCreate([
      { ...sample, name: "Bulk1" },
      { ...sample, name: "Bulk2" },
    ]);
    assert.equal(store.count(), before + 2);
    // Cleanup
    const all = store.getAll({ search: "Bulk" });
    all.forEach((e) => store.remove(e.id));
  });

  it("count returns correct number", () => {
    const c = store.count();
    assert.equal(typeof c, "number");
    assert.ok(c >= 0);
  });
});

describe("findDuplicates", () => {
  let id;

  before(() => { id = store.create(sample); });
  after(() => { store.remove(id); });

  it("detects existing entries", () => {
    const results = store.findDuplicates([
      { name: sample.name, username: sample.username, url: sample.url },
      { name: "Nonexistent", username: "nobody", url: "https://nowhere.com" },
    ]);
    assert.equal(results[0], true);
    assert.equal(results[1], false);
  });
});
