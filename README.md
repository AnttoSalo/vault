# Vault

Self-hosted password and secret manager for personal infrastructure. Encrypts all secrets at rest with AES-256-GCM. Runs behind Gate (auth gateway) with no built-in login.

## Features

- AES-256-GCM encryption at rest for all sensitive fields
- CRUD for passwords, API keys, SSH keys, database credentials, notes
- Search, filter by category, sort by name/created/updated/accessed
- Command palette (`Ctrl+K`) with fuzzy search and instant copy
- Full keyboard navigation (`J/K`, `Enter`, `Esc`, `/`, `N`, `E`, `C`, `U`, `B`)
- Pin/favorite entries to keep them at top
- Recently accessed entries tracking
- Quick-copy username/secret from list view (no page navigation)
- CSV import from Chrome and LastPass with duplicate detection
- Encrypted backup export/import (JSON)
- Password generator with strength indicator
- Input validation with length limits
- Dark and light theme
- Responsive design
- CSRF protection, rate limiting, security headers (Helmet)

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | HTTP listen port | `3200` |
| `VAULT_KEY` | **Yes** | Master encryption key. Generate with `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` | -- |
| `SESSION_SECRET` | No | Session cookie signing key | Auto-generated and persisted to `data/.session-secret` |
| `NODE_ENV` | No | `production` enables secure cookies + binds to 127.0.0.1 | `development` |

---

## Running Locally (Windows — MASTERSTATION)

### First-time setup

```bash
cd C:/Dev/vault
cp .env.example .env
```

Edit `.env` and set `VAULT_KEY`:
```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```
Paste the output as the value of `VAULT_KEY` in `.env`.

```bash
npm install
```

### Start the server

```bash
npm start
# or with auto-reload:
npm run dev
```

Open **http://localhost:3200** (or **http://vault.dev.local** if Caddy is running).

### Run tests

```bash
npm test
```

### Local Caddy (optional)

Already configured in `C:\Dev\Caddyfile`:
```
http://vault.dev.local {
    reverse_proxy localhost:3200
}
```

Already in `C:\Dev\ecosystem.config.js` for PM2:
```bash
pm2 start C:/Dev/ecosystem.config.js --only vault
```

---

## Deploying to NNS Server (Ubuntu 24.04)

### 1. Copy files to server

```bash
rsync -avz --exclude node_modules --exclude data --exclude .env \
  C:/Dev/vault/ antto@homeserver:/srv/dev/vault/
```

### 2. Install dependencies on server

```bash
ssh antto@homeserver
cd /srv/dev/vault
npm install --production
```

### 3. Generate production secrets

```bash
openssl rand -hex 32   # -> VAULT_KEY
openssl rand -hex 32   # -> SESSION_SECRET (optional)
```

### 4. Update PM2 config

Edit `/srv/dev/ecosystem.config.js` — replace the `CHANGE_ME` placeholder:
```js
{
  name: "vault",
  cwd: "/srv/dev/vault",
  script: "server.js",
  env: {
    PORT: 3200,
    NODE_ENV: "production",
    VAULT_KEY: "<paste your generated key>",
    SESSION_SECRET: "<paste your generated key>",
  },
  max_memory_restart: "100M",
},
```

### 5. Add Caddy config

Add to `/etc/caddy/Caddyfile`:
```
vault.antto.org {
    forward_auth localhost:3100 {
        uri /auth/verify
        copy_headers X-Auth-User
    }
    reverse_proxy localhost:3200
}
```

### 6. Add Cloudflare DNS

In Cloudflare dashboard, add a CNAME record:
- Name: `vault`
- Target: tunnel UUID (same as other `*.antto.org` records)

The cloudflared route is already in `C:\Dev\server-cloudflared-config.yml`:
```yaml
- hostname: vault.antto.org
  service: http://127.0.0.1:80
```
Deploy this to `/home/antto/.cloudflared/config.yml` if not already done.

### 7. Start everything

```bash
sudo systemctl reload caddy
sudo systemctl restart cloudflared
pm2 start ecosystem.config.js --only vault
pm2 save
```

### 8. Verify

```bash
curl http://localhost:3200/health
# Should return: {"status":"ok","entries":0}
```

Then open **https://vault.antto.org** — it should redirect to Gate login. After login, the vault loads.

---

## Importing Passwords

### From Chrome

1. Open `chrome://password-manager/settings`
2. Click **Download file** under Export passwords
3. In Vault, click the CSV icon in the footer (or go to `/import/csv`)
4. Drop the file or paste CSV contents
5. Review the preview — duplicates are marked and unchecked by default
6. Click **Import Selected**

### From LastPass

1. Go to **Account Settings** > **Advanced** > **Export** > **Generic CSV file**
2. Same import flow as above

## Backup & Restore

- **Export**: Click the download icon in the footer (or visit `/export`). Downloads a JSON file with all entries (secrets encrypted at rest). The backup can only be restored with the same `VAULT_KEY`.
- **Import**: Click the upload icon, drop or paste the backup JSON.

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `Ctrl+K` | Global | Command palette |
| `/` | Global | Focus search |
| `N` | Global | New entry |
| `Esc` | Global | Close modal / go back |
| `?` | Global | Shortcuts help |
| `J` / `K` | List | Navigate down / up |
| `Enter` | List | Open selected |
| `C` | List/Detail | Copy secret |
| `E` | Detail | Edit entry |
| `U` | Detail | Copy username |
| `B` | Detail | Back to list |

## Security Model

- **Auth**: Gate (external gateway) protects the app via Caddy `forward_auth`. No built-in login.
- **Encryption**: All sensitive fields (username, secret, url, notes) encrypted with AES-256-GCM. Entry names and tags stored in plaintext for search.
- **Key derivation**: `VAULT_KEY` derived to 256-bit key via `scrypt` with static salt.
- **CSRF**: Tokens on all POST forms; XHR exempt via `X-Requested-With` check.
- **Validation**: Input length limits on all fields, whitespace trimming, category/type validation.
- **Rate limiting**: 200 requests/minute per IP.
- **Headers**: Helmet with CSP (nonce-based scripts), X-Content-Type-Options, etc.
- **Cookies**: HTTPOnly, SameSite=Lax, Secure in production.

## Running Tests

```bash
npm test    # 52 tests across crypto, csv, store, routes
```

Uses Node.js built-in test runner (`node:test`). No external test dependencies.

## Tech Stack

- Node.js + Express (ESM)
- EJS templates (server-side rendered)
- SQLite via better-sqlite3 (WAL mode)
- AES-256-GCM encryption (Node crypto)
- Vanilla JavaScript (no build step)
- Plain CSS with custom properties (dark/light themes)
- Bootstrap Icons (CDN)
