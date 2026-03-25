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
- Dark and light theme
- Responsive design
- CSRF protection, rate limiting, security headers (Helmet)

## Quick Start

```bash
git clone https://github.com/AnttoSalo/vault.git
cd vault
cp .env.example .env
# Generate a vault key:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste it as VAULT_KEY in .env
npm install
npm start
# Open http://localhost:3200
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | HTTP listen port | `3200` |
| `VAULT_KEY` | **Yes** | Master encryption key (hex, 32+ chars). Generate with `openssl rand -hex 32` | -- |
| `SESSION_SECRET` | No | Session cookie signing key | Auto-generated and persisted to `data/.session-secret` |
| `NODE_ENV` | No | `production` enables secure cookies + binds to 127.0.0.1 | `development` |

## Production Deployment (NNS Server)

### Prerequisites

- Ubuntu 24.04 with Node.js 20+
- PM2 for process management
- Caddy as reverse proxy
- Gate auth gateway (for forward_auth)
- Cloudflare tunnel for external access

### Steps

1. Copy vault to `/srv/dev/vault` on the server
2. Generate production secrets:
   ```bash
   openssl rand -hex 32  # VAULT_KEY
   openssl rand -hex 32  # SESSION_SECRET
   ```
3. Set env vars in PM2 ecosystem config (`/srv/dev/ecosystem.config.js`)
4. Install and start:
   ```bash
   cd /srv/dev/vault && npm install --production
   pm2 start ecosystem.config.js --only vault
   pm2 save
   ```
5. Add Caddy config for `vault.antto.org`:
   ```
   vault.antto.org {
       forward_auth localhost:3100 {
           uri /auth/verify
           copy_headers X-Auth-User
       }
       reverse_proxy localhost:3200
   }
   ```
6. Add CNAME record in Cloudflare DNS: `vault` -> tunnel
7. Reload Caddy: `sudo systemctl reload caddy`

## Importing Passwords

### From Chrome

1. Open `chrome://password-manager/settings`
2. Click **Download file** under Export passwords
3. In Vault, click the CSV icon in the footer (or go to `/import/csv`)
4. Drop the file or paste CSV contents
5. Review the preview, uncheck duplicates, click **Import Selected**

### From LastPass

1. Go to **Account Settings** > **Advanced** > **Export** > **Generic CSV file**
2. Same import flow as above

## Backup & Restore

- **Export**: Click the download icon in the footer (or visit `/export`). Downloads a JSON file with all entries (encrypted at rest). The backup can only be restored with the same `VAULT_KEY`.
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
- **Rate limiting**: 200 requests/minute per IP.
- **Headers**: Helmet with CSP (nonce-based scripts), X-Content-Type-Options, etc.
- **Cookies**: HTTPOnly, SameSite=Lax, Secure in production.

## Running Tests

```bash
npm test
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
