import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations, resetDb } from "../db/test-helpers.js";
import { registerUser, loginUser, changePassword } from "./auth.js";

describe("auth service (integration)", () => {
  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDb();
  });

  // ─── registerUser ──────────────────────────────────────────────────────────

  describe("registerUser", () => {
    it("creates a user and returns id + displayName", async () => {
      const result = await registerUser("alice@example.com", "Alice", "password123");
      expect(result).not.toHaveProperty("error");
      if ("error" in result) return;
      expect(result.id).toBeTruthy();
      expect(result.displayName).toBe("Alice");
    });

    it("trims whitespace from displayName", async () => {
      const result = await registerUser("bob@example.com", "  Bob  ", "password123");
      if ("error" in result) throw new Error("Registration failed");
      expect(result.displayName).toBe("Bob");
    });

    it("returns email_taken for a duplicate email", async () => {
      await registerUser("carol@example.com", "Carol", "password123");
      const second = await registerUser("carol@example.com", "Carol 2", "password123");
      expect(second).toEqual({ error: "email_taken" });
    });

    it("treats email as case-insensitive (duplicate detection)", async () => {
      await registerUser("dave@example.com", "Dave", "password123");
      const second = await registerUser("DAVE@EXAMPLE.COM", "Dave 2", "password123");
      expect(second).toEqual({ error: "email_taken" });
    });
  });

  // ─── loginUser ─────────────────────────────────────────────────────────────

  describe("loginUser", () => {
    it("returns user for correct credentials", async () => {
      await registerUser("eve@example.com", "Eve", "securepass1");
      const result = await loginUser("eve@example.com", "securepass1");
      expect(result).not.toHaveProperty("error");
      if ("error" in result) return;
      expect(result.displayName).toBe("Eve");
    });

    it("returns invalid_credentials for the wrong password", async () => {
      await registerUser("frank@example.com", "Frank", "correctpassword");
      const result = await loginUser("frank@example.com", "wrongpassword");
      expect(result).toEqual({ error: "invalid_credentials" });
    });

    it("returns invalid_credentials for an unknown email", async () => {
      const result = await loginUser("nobody@example.com", "anypassword");
      expect(result).toEqual({ error: "invalid_credentials" });
    });
  });

  // ─── changePassword ────────────────────────────────────────────────────────

  describe("changePassword", () => {
    it("changes the password and allows login with the new password", async () => {
      const reg = await registerUser("grace@example.com", "Grace", "oldpass123");
      if ("error" in reg) throw new Error("Registration failed");

      const change = await changePassword(reg.id, "oldpass123", "newpass456");
      expect(change).toEqual({ success: true });

      const loginNew = await loginUser("grace@example.com", "newpass456");
      expect(loginNew).not.toHaveProperty("error");

      const loginOld = await loginUser("grace@example.com", "oldpass123");
      expect(loginOld).toEqual({ error: "invalid_credentials" });
    });

    it("returns invalid_credentials for a wrong current password", async () => {
      const reg = await registerUser("henry@example.com", "Henry", "correctpass");
      if ("error" in reg) throw new Error("Registration failed");

      const result = await changePassword(reg.id, "wrongpass", "newpass123");
      expect(result).toEqual({ error: "invalid_credentials" });
    });
  });
});
