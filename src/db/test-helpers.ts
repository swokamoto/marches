/**
 * Helpers for integration tests that need a real database.
 *
 * runMigrations() — run all Drizzle migrations against the test DB (idempotent).
 *   Call once in beforeAll() at the top of each integration test suite.
 *
 * resetDb() — TRUNCATE every application table and restart sequences.
 *   Call in beforeEach() to ensure a clean slate between tests.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";

function getDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Is the test DB running?");
  return url;
}

export async function runMigrations(): Promise<void> {
  const sql = postgres(getDbUrl(), { max: 1 });
  const db = drizzle(sql);
  const migrationsFolder = path.join(__dirname, "migrations");
  await migrate(db, { migrationsFolder });
  await sql.end();
}

export async function resetDb(): Promise<void> {
  const sql = postgres(getDbUrl(), { max: 1 });
  try {
    // TRUNCATE with RESTART IDENTITY (reset sequences) and CASCADE (handle FKs).
    // Tables are listed leaf-first to make the intent clear, but CASCADE handles order.
    await sql`
      TRUNCATE TABLE
        activity_log,
        world_events,
        world_changes,
        session_player_notes,
        session_participants,
        session_reports,
        sessions,
        expedition_artifacts,
        expedition_npcs,
        expedition_locations,
        expedition_participants,
        expeditions,
        journal_entries,
        artifacts,
        npcs,
        location_connections,
        locations,
        characters,
        campaign_settings,
        campaign_members,
        campaigns,
        users
      RESTART IDENTITY CASCADE
    `;
  } finally {
    await sql.end();
  }
}
