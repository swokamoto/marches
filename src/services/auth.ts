import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 12;

export type AuthError =
  | "email_taken"
  | "invalid_credentials"
  | "user_not_found";

export async function registerUser(
  email: string,
  displayName: string,
  password: string
): Promise<{ id: string; displayName: string } | { error: AuthError }> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
    columns: { id: true },
  });

  if (existing) {
    return { error: "email_taken" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase().trim(),
      displayName: displayName.trim(),
      passwordHash,
    })
    .returning({ id: users.id, displayName: users.displayName });

  return user;
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ id: string; displayName: string } | { error: AuthError }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
    columns: {
      id: true,
      displayName: true,
      passwordHash: true,
    },
  });

  if (!user) {
    // Hash a dummy value to prevent timing attacks that reveal whether
    // an email exists by measuring response time differences.
    await bcrypt.hash("dummy", SALT_ROUNDS);
    return { error: "invalid_credentials" };
  }

  if (!user.passwordHash) {
    // Account exists but was created via OAuth — no password set
    return { error: "invalid_credentials" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "invalid_credentials" };
  }

  return { id: user.id, displayName: user.displayName };
}
