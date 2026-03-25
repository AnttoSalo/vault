import crypto from "crypto";
import { VAULT_KEY } from "../config.js";

const key = crypto.scryptSync(VAULT_KEY, "vault-salt", 32);

export function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

export function decrypt(stored) {
  if (!stored) return null;
  const [ivHex, authTagHex, ciphertext] = stored.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(ciphertext, "hex", "utf8") + decipher.final("utf8");
}

export function generatePassword(length = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
