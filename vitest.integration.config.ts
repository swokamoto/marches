import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load test env vars into the main process so they're available in globalSetup
// and inherited by worker processes (workers also receive them via test.env below).
const testEnv = config({ path: ".env.test" });

if (!testEnv.parsed?.DATABASE_URL) {
  throw new Error(
    "Integration tests require a test database.\n" +
    "Create a .env.test file with DATABASE_URL pointing to your test DB.\n" +
    "See .env.example for the format, then start the test DB with:\n" +
    "  docker compose up test-db -d"
  );
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // Run test files sequentially so resetDb() in beforeEach doesn't race
    fileParallelism: false,
    // Inject the test DB URL into every worker process
    env: {
      DATABASE_URL: testEnv.parsed.DATABASE_URL,
    },
    // Run migration once before any test suite runs
    globalSetup: ["src/db/test-setup.ts"],
  },
});
