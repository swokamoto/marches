import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import "../types/session.d.js";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

// Separate pg.Pool for the session store.
// We use postgres.js (postgres) for Drizzle queries and pg for the session
// store — connect-pg-simple is built against the pg driver.
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({
    pool: pgPool,
    createTableIfMissing: true, // creates the "session" table on first run
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // not accessible via JS — prevents XSS session theft
    secure: process.env.NODE_ENV === "production", // HTTPS-only in prod
    sameSite: "lax", // CSRF mitigation
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
