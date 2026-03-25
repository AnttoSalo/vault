# CLAUDE.md -- Vault Password Manager

## Project Goal

Self-hosted password/secret manager. Single-user. Auth handled by Gate (external, via Caddy forward_auth).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Framework | Express 4 |
| Templating | EJS |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Encryption | AES-256-GCM (Node crypto) |
| Auth | Gate (external, via Caddy forward_auth) |
| Styling | Plain CSS (custom properties, dark/light themes) |
| Icons | Bootstrap Icons (CDN) |
| Tests | `node:test` + `node:assert` (built-in) |

No build step, no bundler, no TypeScript, no external test frameworks.

## Folder Structure

```
vault/
  server.js             # Express app, middleware, session, CSRF
  config.js             # Environment variables (PORT, VAULT_KEY, SESSION_SECRET)
  package.json
  .env.example          # Required env vars template
  lib/
    crypto.js           # AES-256-GCM encrypt/decrypt + password generator
    db.js               # SQLite connection, schema, migrations
    store.js            # Entry CRUD, search, sort, pin, bulk import, dedup
    csv.js              # CSV parser + Chrome/LastPass format conversion
  routes/
    entries.js          # All routes (pages + API endpoints)
  views/
    index.ejs           # Entry list with search, filters, sort
    entry-form.ejs      # Create/edit form with password generator + strength bar
    entry-detail.ejs    # Entry detail view with copy buttons
    import-csv.ejs      # CSV import wizard (preview + confirm)
    error.ejs           # Error page (404/500)
    partials/
      header.ejs        # HTML head, navbar
      footer.ejs        # Toast, command palette, shortcuts modal, theme toggle, JS
      entry-card.ejs    # Card component for list view
  public/
    style.css           # All styles (dark/light themes, responsive, animations)
    vault.js            # Client-side JS (keyboard shortcuts, palette, copy, etc.)
  test/
    crypto.test.js      # Encryption round-trip, tamper detection, password gen
    csv.test.js         # CSV parsing, format detection, conversion
    store.test.js       # CRUD, search, sort, pin, touch, dedup
    routes.test.js      # HTTP route smoke tests with CSRF
  data/                 # Runtime (gitignored)
    vault.db            # SQLite database
    .session-secret     # Auto-generated session secret
```

## Database Schema

```sql
entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- plaintext (searchable)
  category TEXT NOT NULL DEFAULT 'other', -- server|api-keys|databases|personal|business|other
  type TEXT NOT NULL DEFAULT 'password',  -- password|api-key|database|ssh-key|note|ftp
  username TEXT,                         -- encrypted (AES-256-GCM)
  secret TEXT NOT NULL,                  -- encrypted
  url TEXT,                              -- encrypted
  notes TEXT,                            -- encrypted
  tags TEXT,                             -- plaintext (searchable, comma-separated)
  pinned INTEGER NOT NULL DEFAULT 0,
  lastAccessedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
)
```

## Route Map

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Entry list (search, filter, sort) |
| GET | `/new` | New entry form (supports `?from=id` for duplication) |
| POST | `/new` | Create entry (with validation) |
| GET | `/entry/:id` | View entry detail |
| GET | `/entry/:id/edit` | Edit form |
| POST | `/entry/:id/edit` | Update entry (with validation) |
| POST | `/entry/:id/delete` | Delete entry |
| GET | `/api/entry/:id/secret` | XHR: get decrypted secret + track access |
| GET | `/api/entries` | XHR: entry metadata for command palette (no secrets) |
| POST | `/api/entry/:id/pin` | XHR: toggle pin |
| GET | `/health` | Health check |
| GET | `/export` | Download encrypted backup JSON |
| POST | `/import` | Import backup JSON |
| GET | `/import/csv` | CSV import page |
| POST | `/import/csv/preview` | Parse + preview CSV (with duplicate detection) |
| POST | `/import/csv/confirm` | Confirm + save CSV entries |

## Key Patterns

### Encryption
- `encrypt(plaintext)` returns `iv:authTag:ciphertext` (hex)
- `decrypt(stored)` returns original plaintext
- Key derived from VAULT_KEY via scrypt with hardcoded salt
- Random IV per encryption (same input produces different output)
- Encrypted fields: username, secret, url, notes
- Plaintext fields (for search/sort): name, tags, category, type

### Store Pattern
- All CRUD through `lib/store.js` (never direct DB access in routes)
- `encryptEntry()` before write, `decryptEntry()` after read
- Transactions for bulk operations (`bulkCreate`, `importEntries`)

### Input Validation
- `validate(body)` in `routes/entries.js` — max lengths, trim, type checking
- Returns `{ error }` or `{ fields }` — routes use destructuring

### CSRF
- Token generated on every request, stored in session
- All POST forms include hidden `_csrf` field
- XHR requests exempt (checked via `X-Requested-With` header)

### Auth
- NO built-in auth. Gate handles everything externally via Caddy forward_auth.
- Do NOT add login pages, user tables, or session auth to this app.

## What Not to Touch

- Do not add authentication/login — Gate handles this
- Do not add external dependencies without strong justification
- Do not change the encryption scheme (would invalidate all existing data)
- Do not remove the scrypt salt from `crypto.js` (would change derived key)
- Do not change the DB schema column names (would break existing data)
- Keep `data/` and `.env` in `.gitignore`

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `PORT` | No | `3200` |
| `VAULT_KEY` | **Yes** | -- (app exits without it) |
| `SESSION_SECRET` | No | Auto-persisted to `data/.session-secret` |
| `NODE_ENV` | No | `development` |
| `VAULT_DB_PATH` | No | `data/vault.db` (override for tests) |

## Common Commands

```bash
npm start       # Start server
npm run dev     # Start with auto-reload (nodemon)
npm test        # Run tests (node:test)
```
