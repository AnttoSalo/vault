// Simple CSV parser that handles quoted fields and newlines within quotes
export function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        current.push(field);
        field = "";
        if (current.some((f) => f.trim())) rows.push(current);
        current = [];
        i += ch === "\r" ? 2 : 1;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/row
  current.push(field);
  if (current.some((f) => f.trim())) rows.push(current);

  return rows;
}

// Detect format from headers
export function detectFormat(headers) {
  const h = headers.map((s) => s.trim().toLowerCase());
  if (h.includes("totp") || h.includes("grouping") || h.includes("extra")) return "lastpass";
  if (h.includes("name") && h.includes("url") && h.includes("username") && h.includes("password")) return "chrome";
  if (h.length === 3 && h[0] === "url" && h[1] === "username" && h[2] === "password") return "chrome";
  if (h.includes("url") && h.includes("username") && h.includes("password")) return "generic";
  return "unknown";
}

// Extract hostname from URL for naming
function nameFromUrl(url) {
  if (!url) return "Unnamed";
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // Capitalize first letter
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    return url.slice(0, 50) || "Unnamed";
  }
}

// Guess category from URL/grouping/name
function guessCategory(url, grouping, name) {
  const lower = (url + " " + (grouping || "") + " " + (name || "")).toLowerCase();
  if (/api|key|token|developer/.test(lower)) return "api-keys";
  if (/database|postgres|mysql|mongo|redis|mariadb|sqlite|supabase/.test(lower)) return "databases";
  if (/ssh|ftp|sftp|server|admin|cpanel|hosting|vps|digitalocean|aws|azure/.test(lower)) return "server";
  if (/bank|finance|paypal|invoice|billing|tax|stripe|accounting/.test(lower)) return "business";
  return "personal";
}

// Guess type from context
function guessType(url, name) {
  const lower = ((url || "") + " " + (name || "")).toLowerCase();
  if (/api|key|token/.test(lower)) return "api-key";
  if (/ssh/.test(lower)) return "ssh-key";
  if (/ftp|sftp/.test(lower)) return "ftp";
  if (/database|postgres|mysql|mongo|redis|mariadb|sqlite|supabase/.test(lower)) return "database";
  return "password";
}

// Convert Chrome CSV rows to vault entries
function convertChrome(rows, headers) {
  const h = headers.map((s) => s.trim().toLowerCase());
  const nameIdx = h.indexOf("name");
  const urlIdx = h.indexOf("url");
  const userIdx = h.indexOf("username");
  const pwIdx = h.indexOf("password");

  return rows.map((row) => {
    const url = row[urlIdx] || "";
    const name = (nameIdx >= 0 ? row[nameIdx] : "") || nameFromUrl(url);
    const username = row[userIdx] || "";
    const secret = row[pwIdx] || "";
    return {
      name,
      category: guessCategory(url, "", name),
      type: guessType(url, name),
      username,
      secret,
      url,
      notes: "",
      tags: "chrome-import",
    };
  });
}

// Convert LastPass CSV rows to vault entries
function convertLastPass(rows, headers) {
  const h = headers.map((s) => s.trim().toLowerCase());
  const urlIdx = h.indexOf("url");
  const userIdx = h.indexOf("username");
  const pwIdx = h.indexOf("password");
  const extraIdx = h.indexOf("extra");
  const nameIdx = h.indexOf("name");
  const groupIdx = h.indexOf("grouping");
  const favIdx = h.indexOf("fav");

  return rows.map((row) => {
    const url = row[urlIdx] || "";
    const grouping = row[groupIdx] || "";
    const name = row[nameIdx] || nameFromUrl(url);
    const username = row[userIdx] || "";
    const secret = row[pwIdx] || "";
    const notes = row[extraIdx] || "";
    const fav = row[favIdx] === "1";

    // Decode HTML entities that LastPass sometimes exports
    const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

    return {
      name: decode(name),
      category: guessCategory(url, grouping, name),
      type: guessType(url, name),
      username: decode(username),
      secret: decode(secret),
      url: decode(url),
      notes: decode(notes),
      tags: grouping ? grouping.replace(/\//g, ", ").toLowerCase() : "lastpass-import",
      _fav: fav,
    };
  });
}

// Main conversion function
export function convertCSV(csvText) {
  const rows = parseCSV(csvText.trim());
  if (rows.length < 2) return { error: "CSV has no data rows.", entries: [], format: "unknown" };

  const headers = rows[0];
  const format = detectFormat(headers);
  const dataRows = rows.slice(1);

  if (format === "unknown") {
    return { error: `Unrecognized CSV format. Headers: ${headers.join(", ")}`, entries: [], format };
  }

  let entries;
  if (format === "lastpass") {
    entries = convertLastPass(dataRows, headers);
  } else {
    entries = convertChrome(dataRows, headers);
  }

  // Filter out entries with no secret (empty passwords)
  entries = entries.filter((e) => e.secret);

  return { entries, format, error: null };
}
