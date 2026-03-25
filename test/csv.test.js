import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCSV, detectFormat, convertCSV } from "../lib/csv.js";

describe("parseCSV", () => {
  it("parses simple CSV", () => {
    const rows = parseCSV("a,b,c\n1,2,3");
    assert.deepEqual(rows, [["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted fields with commas", () => {
    const rows = parseCSV('name,value\n"Smith, John",42');
    assert.deepEqual(rows[1], ["Smith, John", "42"]);
  });

  it("handles escaped quotes", () => {
    const rows = parseCSV('a\n"say ""hello"""');
    assert.deepEqual(rows[1], ['say "hello"']);
  });

  it("handles newlines within quotes", () => {
    const rows = parseCSV('a,b\n"line1\nline2",val');
    assert.equal(rows[1][0], "line1\nline2");
    assert.equal(rows[1][1], "val");
  });

  it("handles CRLF line endings", () => {
    const rows = parseCSV("a,b\r\n1,2\r\n3,4");
    assert.equal(rows.length, 3);
  });

  it("skips empty rows", () => {
    const rows = parseCSV("a,b\n\n1,2\n\n");
    assert.equal(rows.length, 2);
  });
});

describe("detectFormat", () => {
  it("detects Chrome with name column", () => {
    assert.equal(detectFormat(["name", "url", "username", "password"]), "chrome");
  });

  it("detects Chrome minimal (3 columns)", () => {
    assert.equal(detectFormat(["url", "username", "password"]), "chrome");
  });

  it("detects LastPass", () => {
    assert.equal(detectFormat(["url", "username", "password", "totp", "extra", "name", "grouping", "fav"]), "lastpass");
  });

  it("returns unknown for unrecognized headers", () => {
    assert.equal(detectFormat(["foo", "bar"]), "unknown");
  });
});

describe("convertCSV", () => {
  it("converts Chrome CSV", () => {
    const csv = "name,url,username,password\nGoogle,https://google.com,user@gmail.com,pass123";
    const { entries, format, error } = convertCSV(csv);
    assert.equal(error, null);
    assert.equal(format, "chrome");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, "Google");
    assert.equal(entries[0].username, "user@gmail.com");
    assert.equal(entries[0].secret, "pass123");
    assert.equal(entries[0].url, "https://google.com");
  });

  it("converts LastPass CSV", () => {
    const csv = "url,username,password,totp,extra,name,grouping,fav\nhttps://aws.com,admin,awspass,,,AWS Console,Work/Cloud,1";
    const { entries, format } = convertCSV(csv);
    assert.equal(format, "lastpass");
    assert.equal(entries[0].name, "AWS Console");
    assert.equal(entries[0].tags, "work, cloud");
  });

  it("filters out entries with empty passwords", () => {
    const csv = "url,username,password\nhttps://a.com,user,pass\nhttps://b.com,user,";
    const { entries } = convertCSV(csv);
    assert.equal(entries.length, 1);
  });

  it("decodes HTML entities in LastPass", () => {
    const csv = "url,username,password,totp,extra,name,grouping,fav\nhttps://test.com,user&amp;name,pass&lt;123&gt;,,,Test &amp; Co,,0";
    const { entries } = convertCSV(csv);
    assert.equal(entries[0].username, "user&name");
    assert.equal(entries[0].secret, "pass<123>");
    assert.equal(entries[0].name, "Test & Co");
  });

  it("guesses database category", () => {
    const csv = "url,username,password\nhttps://postgres.example.com,admin,dbpass";
    const { entries } = convertCSV(csv);
    assert.equal(entries[0].category, "databases");
  });

  it("extracts name from URL when missing", () => {
    const csv = "url,username,password\nhttps://www.netflix.com,user,pass";
    const { entries } = convertCSV(csv);
    assert.equal(entries[0].name, "Netflix.com");
  });

  it("returns error for too few rows", () => {
    const { error } = convertCSV("url,username,password");
    assert.ok(error);
  });

  it("returns error for unknown format", () => {
    const { error, format } = convertCSV("foo,bar\n1,2");
    assert.ok(error);
    assert.equal(format, "unknown");
  });
});
