import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.VAULT_KEY = "test-key-do-not-use-in-production";

const { encrypt, decrypt, generatePassword } = await import("../lib/crypto.js");

describe("encrypt/decrypt", () => {
  it("round-trips a string", () => {
    const plain = "my-secret-password-123!";
    const encrypted = encrypt(plain);
    assert.equal(decrypt(encrypted), plain);
  });

  it("returns null for null input", () => {
    assert.equal(encrypt(null), null);
    assert.equal(decrypt(null), null);
  });

  it("returns null for empty string", () => {
    assert.equal(encrypt(""), null);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const a = encrypt("same-text");
    const b = encrypt("same-text");
    assert.notEqual(a, b);
    // But both decrypt to the same value
    assert.equal(decrypt(a), "same-text");
    assert.equal(decrypt(b), "same-text");
  });

  it("produces ciphertext in iv:tag:data format", () => {
    const enc = encrypt("test");
    const parts = enc.split(":");
    assert.equal(parts.length, 3);
    // All parts should be hex strings
    for (const part of parts) {
      assert.match(part, /^[0-9a-f]+$/);
    }
  });

  it("throws on tampered ciphertext", () => {
    const enc = encrypt("test");
    const [iv, tag, data] = enc.split(":");
    const tampered = iv + ":" + tag + ":" + "ff" + data.slice(2);
    assert.throws(() => decrypt(tampered));
  });

  it("handles unicode", () => {
    const plain = "pässwörd 🔑 日本語";
    assert.equal(decrypt(encrypt(plain)), plain);
  });
});

describe("generatePassword", () => {
  it("returns default length of 32", () => {
    assert.equal(generatePassword().length, 32);
  });

  it("returns requested length", () => {
    assert.equal(generatePassword(16).length, 16);
    assert.equal(generatePassword(64).length, 64);
  });

  it("uses only allowed characters", () => {
    const allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_-+=";
    const pw = generatePassword(100);
    for (const ch of pw) {
      assert.ok(allowed.includes(ch), `Unexpected character: ${ch}`);
    }
  });
});
