/**
 * Vitest globalSetup — runs once before any integration test suite.
 * Applies all pending Drizzle migrations to the test database.
 */
import { runMigrations } from "./test-helpers.js";

export async function setup(): Promise<void> {
  await runMigrations();
  console.log("[test-setup] Migrations applied to test database.");
}
