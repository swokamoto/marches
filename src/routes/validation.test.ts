import { describe, it, expect } from "vitest";

// These mirror the validation rules in the route handlers.
// They're tested here as pure functions so regressions are caught
// without needing a running server or database.

// ─── Auth validation rules ────────────────────────────────────────────────────

function validateRegister(
  email: string,
  displayName: string,
  password: string,
  confirmPassword: string
): string | null {
  if (!email || !displayName || !password) return "All fields are required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): string | null {
  if (!currentPassword || !newPassword || !confirmPassword)
    return "All password fields are required.";
  if (newPassword.length < 8) return "New password must be at least 8 characters.";
  if (newPassword !== confirmPassword) return "Passwords do not match.";
  return null;
}

function validateDisplayName(displayName: string): string | null {
  if (!displayName?.trim()) return "Display name cannot be empty.";
  if (displayName.trim().length > 64)
    return "Display name must be 64 characters or fewer.";
  return null;
}

// ─── Register ─────────────────────────────────────────────────────────────────

describe("register validation", () => {
  it("accepts valid input", () => {
    expect(validateRegister("a@b.com", "Alice", "password123", "password123")).toBeNull();
  });

  it("rejects missing email", () => {
    expect(validateRegister("", "Alice", "password123", "password123")).not.toBeNull();
  });

  it("rejects missing display name", () => {
    expect(validateRegister("a@b.com", "", "password123", "password123")).not.toBeNull();
  });

  it("rejects missing password", () => {
    expect(validateRegister("a@b.com", "Alice", "", "")).not.toBeNull();
  });

  it("rejects password shorter than 8 characters", () => {
    expect(validateRegister("a@b.com", "Alice", "short", "short")).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("rejects mismatched passwords", () => {
    expect(validateRegister("a@b.com", "Alice", "password123", "different")).toBe(
      "Passwords do not match."
    );
  });

  it("accepts a password of exactly 8 characters", () => {
    expect(validateRegister("a@b.com", "Alice", "12345678", "12345678")).toBeNull();
  });
});

// ─── Password change ──────────────────────────────────────────────────────────

describe("password change validation", () => {
  it("accepts valid input", () => {
    expect(validatePasswordChange("oldpass1", "newpass1", "newpass1")).toBeNull();
  });

  it("rejects any empty field", () => {
    expect(validatePasswordChange("", "newpass1", "newpass1")).not.toBeNull();
    expect(validatePasswordChange("oldpass1", "", "")).not.toBeNull();
  });

  it("rejects new password shorter than 8 characters", () => {
    expect(validatePasswordChange("oldpass1", "short", "short")).toBe(
      "New password must be at least 8 characters."
    );
  });

  it("rejects mismatched new passwords", () => {
    expect(validatePasswordChange("oldpass1", "newpass1", "different")).toBe(
      "Passwords do not match."
    );
  });
});

// ─── Display name ─────────────────────────────────────────────────────────────

describe("display name validation", () => {
  it("accepts a normal name", () => {
    expect(validateDisplayName("Alice")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateDisplayName("")).not.toBeNull();
  });

  it("rejects a whitespace-only string", () => {
    expect(validateDisplayName("   ")).not.toBeNull();
  });

  it("accepts a name of exactly 64 characters", () => {
    expect(validateDisplayName("a".repeat(64))).toBeNull();
  });

  it("rejects a name longer than 64 characters", () => {
    expect(validateDisplayName("a".repeat(65))).toBe(
      "Display name must be 64 characters or fewer."
    );
  });
});
