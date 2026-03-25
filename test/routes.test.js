import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { unlinkSync } from "fs";
import { tmpdir } from "os";
import { createServer } from "http";

// Set up test environment
const testDb = join(tmpdir(), `vault-routes-test-${Date.now()}.db`);
process.env.VAULT_DB_PATH = testDb;
process.env.VAULT_KEY = "test-key-for-route-tests";
process.env.PORT = "0"; // Let OS assign port
process.env.NODE_ENV = "development";

const { app } = await import("../server.js");

let server;
let baseUrl;

before(() => {
  return new Promise((resolve) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  return new Promise((resolve) => {
    server.close(() => {
      try { unlinkSync(testDb); } catch {}
      try { unlinkSync(testDb + "-wal"); } catch {}
      try { unlinkSync(testDb + "-shm"); } catch {}
      resolve();
    });
  });
});

describe("GET routes", () => {
  it("GET / returns 200", async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Vault"));
  });

  it("GET /new returns 200", async () => {
    const res = await fetch(`${baseUrl}/new`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("New Entry") || html.includes("Create Entry"));
  });

  it("GET /health returns JSON", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");
    assert.equal(typeof data.entries, "number");
  });

  it("GET /entry/999 returns 404", async () => {
    const res = await fetch(`${baseUrl}/entry/999`);
    assert.equal(res.status, 404);
  });

  it("GET /api/entries returns JSON array", async () => {
    const res = await fetch(`${baseUrl}/api/entries`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  it("GET /import/csv returns 200", async () => {
    const res = await fetch(`${baseUrl}/import/csv`);
    assert.equal(res.status, 200);
  });
});

describe("POST routes with CSRF", () => {
  // Helper to get session cookie and CSRF token
  async function getCsrf() {
    const res = await fetch(`${baseUrl}/new`);
    const cookies = res.headers.getSetCookie?.() || [res.headers.get("set-cookie")].filter(Boolean);
    const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    const html = await res.text();
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    return { cookie, csrf: match?.[1] };
  }

  it("POST /new creates an entry and redirects", async () => {
    const { cookie, csrf } = await getCsrf();
    const body = new URLSearchParams({
      _csrf: csrf,
      name: "Route Test Entry",
      category: "server",
      type: "password",
      username: "testuser",
      secret: "testpass123",
      url: "",
      notes: "",
      tags: "",
    });
    const res = await fetch(`${baseUrl}/new`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body: body.toString(),
      redirect: "manual",
    });
    assert.equal(res.status, 302);
    assert.ok(res.headers.get("location").startsWith("/entry/"));
  });

  it("POST /new rejects empty name", async () => {
    const { cookie, csrf } = await getCsrf();
    const body = new URLSearchParams({
      _csrf: csrf,
      name: "",
      secret: "test",
    });
    const res = await fetch(`${baseUrl}/new`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body: body.toString(),
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("required"));
  });
});
