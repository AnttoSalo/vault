import { Router } from "express";
import * as store from "../lib/store.js";
import { convertCSV } from "../lib/csv.js";

const router = Router();

const CATEGORIES = ["server", "api-keys", "databases", "personal", "business", "other"];
const TYPES = ["password", "api-key", "database", "ssh-key", "note", "ftp"];

// List all entries
router.get("/", (req, res) => {
  const { search, category } = req.query;
  const entries = store.getAll({ search, category });
  res.render("index", {
    entries,
    search: search || "",
    category: category || "all",
    categories: CATEGORIES,
    flash: (() => { const f = req.session.flash; delete req.session.flash; return f || null; })(),
  });
});

// New entry form (supports ?from=id for duplication)
router.get("/new", (req, res) => {
  let entry = null;
  if (req.query.from) {
    const source = store.getById(req.query.from);
    if (source) {
      entry = { ...source, id: null, name: `Copy of ${source.name}` };
    }
  }
  res.render("entry-form", {
    entry,
    categories: CATEGORIES,
    types: TYPES,
    error: null,
  });
});

// Create entry
router.post("/new", (req, res) => {
  const { name, category, type, username, secret, url, notes, tags } = req.body;
  if (!name || !secret) {
    return res.render("entry-form", {
      entry: req.body,
      categories: CATEGORIES,
      types: TYPES,
      error: "Name and secret are required.",
    });
  }
  const id = store.create({ name, category, type, username, secret, url, notes, tags });
  req.session.flash = { type: "success", message: "Entry created." };
  res.redirect(`/entry/${id}`);
});

// View entry detail
router.get("/entry/:id", (req, res) => {
  const entry = store.getById(req.params.id);
  if (!entry) return res.status(404).render("error", { status: 404, message: "Entry not found." });
  const flash = req.session.flash;
  if (flash) delete req.session.flash;
  res.render("entry-detail", { entry, flash });
});

// Edit entry form
router.get("/entry/:id/edit", (req, res) => {
  const entry = store.getById(req.params.id);
  if (!entry) return res.status(404).render("error", { status: 404, message: "Entry not found." });
  res.render("entry-form", {
    entry,
    categories: CATEGORIES,
    types: TYPES,
    error: null,
  });
});

// Update entry
router.post("/entry/:id/edit", (req, res) => {
  const { name, category, type, username, secret, url, notes, tags } = req.body;
  if (!name || !secret) {
    return res.render("entry-form", {
      entry: { ...req.body, id: req.params.id },
      categories: CATEGORIES,
      types: TYPES,
      error: "Name and secret are required.",
    });
  }
  store.update(req.params.id, { name, category, type, username, secret, url, notes, tags });
  req.session.flash = { type: "success", message: "Entry updated." };
  res.redirect(`/entry/${req.params.id}`);
});

// Delete entry
router.post("/entry/:id/delete", (req, res) => {
  store.remove(req.params.id);
  req.session.flash = { type: "success", message: "Entry deleted." };
  res.redirect("/");
});

// XHR: get decrypted secret for clipboard copy (also tracks access)
router.get("/api/entry/:id/secret", (req, res) => {
  const entry = store.getById(req.params.id);
  if (!entry) return res.status(404).json({ error: "Not found" });
  store.touch(req.params.id);
  res.json({ secret: entry.secret, username: entry.username });
});

// XHR: entry metadata for command palette (no secrets)
router.get("/api/entries", (req, res) => {
  const entries = store.getAllMeta({ search: req.query.q });
  res.json(entries);
});

// XHR: toggle pin
router.post("/api/entry/:id/pin", (req, res) => {
  const pinned = store.togglePin(req.params.id);
  res.json({ pinned: !!pinned });
});

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "ok", entries: store.count() });
});

// Export all entries (encrypted)
router.get("/export", (_req, res) => {
  const entries = store.getAllRaw();
  res.setHeader("Content-Disposition", `attachment; filename="vault-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ version: 1, exportedAt: new Date().toISOString(), entries });
});

// Import entries
router.post("/import", (req, res) => {
  try {
    const data = JSON.parse(req.body.data);
    if (!data.entries || !Array.isArray(data.entries)) {
      req.session.flash = { type: "error", message: "Invalid backup format." };
      return res.redirect("/");
    }
    store.importEntries(data.entries);
    req.session.flash = { type: "success", message: `Imported ${data.entries.length} entries.` };
  } catch (e) {
    req.session.flash = { type: "error", message: "Failed to parse backup file." };
  }
  res.redirect("/");
});

// CSV import page
router.get("/import/csv", (_req, res) => {
  res.render("import-csv", { result: null, error: null });
});

// CSV import: parse and preview
router.post("/import/csv/preview", (req, res) => {
  const { csv } = req.body;
  if (!csv || !csv.trim()) {
    return res.render("import-csv", { result: null, error: "No CSV data provided." });
  }
  const result = convertCSV(csv);
  if (result.error) {
    return res.render("import-csv", { result: null, error: result.error });
  }
  // Store parsed entries in session for the confirm step
  req.session.csvEntries = result.entries;
  res.render("import-csv", { result, error: null });
});

// CSV import: confirm and save
router.post("/import/csv/confirm", (req, res) => {
  const entries = req.session.csvEntries;
  if (!entries || !entries.length) {
    req.session.flash = { type: "error", message: "No entries to import. Please parse CSV first." };
    return res.redirect("/import/csv");
  }

  // Get selected indices (checkboxes) — if none selected, import all
  let selected = req.body.selected;
  let toImport;
  if (selected) {
    if (!Array.isArray(selected)) selected = [selected];
    const indices = new Set(selected.map(Number));
    toImport = entries.filter((_, i) => indices.has(i));
  } else {
    toImport = entries;
  }

  // Clean up _fav field and apply pin for LastPass favorites
  const cleaned = toImport.map(({ _fav, ...rest }) => rest);

  const count = store.bulkCreate(cleaned);
  delete req.session.csvEntries;

  // Pin favorites from LastPass
  if (toImport.some((e) => e._fav)) {
    // We'd need the IDs, but bulk insert doesn't return them easily.
    // Skip auto-pin for now — users can pin manually.
  }

  req.session.flash = { type: "success", message: `Imported ${count} entries from CSV.` };
  res.redirect("/");
});

export default router;
