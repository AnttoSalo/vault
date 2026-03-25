import { Router } from "express";
import * as store from "../lib/store.js";
import { encrypt } from "../lib/crypto.js";

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

// New entry form
router.get("/new", (req, res) => {
  res.render("entry-form", {
    entry: null,
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

// XHR: get decrypted secret for clipboard copy
router.get("/api/entry/:id/secret", (req, res) => {
  const entry = store.getById(req.params.id);
  if (!entry) return res.status(404).json({ error: "Not found" });
  res.json({ secret: entry.secret, username: entry.username });
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

export default router;
