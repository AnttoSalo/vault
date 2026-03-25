import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import crypto from "crypto";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { PORT, NODE_ENV, SESSION_SECRET } from "./config.js";
import entriesRouter from "./routes/entries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Trust proxy (behind Caddy)
app.set("trust proxy", 1);

// View engine
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

// Security headers
app.use((_req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("hex");
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (_req, res) => `'nonce-${res.locals.nonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);

// Rate limiting
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Static files
app.use(express.static(join(__dirname, "public")));

// Sessions (for CSRF + flash messages)
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// CSRF protection
app.use((req, res, next) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  res.locals.csrfToken = req.session.csrfToken;
  if (req.method === "GET" || req.method === "HEAD") return next();
  // Skip CSRF for XHR requests
  if (req.headers["x-requested-with"] === "XMLHttpRequest") return next();
  if (req.body?._csrf !== req.session.csrfToken) {
    return res.status(403).render("error", { status: 403, message: "Invalid CSRF token." });
  }
  next();
});

// Pass nonce to all views
app.use((_req, res, next) => {
  res.locals.NODE_ENV = NODE_ENV;
  next();
});

// Routes
app.use("/", entriesRouter);

// 404
app.use((_req, res) => {
  res.status(404).render("error", { status: 404, message: "Page not found." });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).render("error", { status: 500, message: NODE_ENV === "production" ? "Server error." : err.message });
});

// Start (only when run directly, not when imported for tests)
const host = NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0";
if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, "/") === resolve(process.argv[1]).replace(/\\/g, "/")) {
  app.listen(PORT, host, () => {
    console.log(`Vault running on http://${host}:${PORT}`);
  });
}

export { app };
