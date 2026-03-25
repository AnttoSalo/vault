import { config } from "dotenv";
import crypto from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PORT = process.env.PORT || 3200;
export const VAULT_KEY = process.env.VAULT_KEY;
export const NODE_ENV = process.env.NODE_ENV || "development";

if (!VAULT_KEY) {
  console.error("VAULT_KEY environment variable is required");
  process.exit(1);
}

// Session secret: env var > persisted file > generate new
const SESSION_SECRET_PATH = join(process.env.VAULT_DB_PATH ? dirname(process.env.VAULT_DB_PATH) : join(__dirname, "data"), ".session-secret");

function loadSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    return readFileSync(SESSION_SECRET_PATH, "utf-8").trim();
  } catch {
    const secret = crypto.randomBytes(32).toString("hex");
    mkdirSync(dirname(SESSION_SECRET_PATH), { recursive: true });
    writeFileSync(SESSION_SECRET_PATH, secret);
    return secret;
  }
}

export const SESSION_SECRET = loadSessionSecret();
