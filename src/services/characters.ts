import { db } from "../db/index.js";
import { characters } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Character = InferSelectModel<typeof characters>;
export type CharacterStatus = Character["status"];

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCharacters(campaignId: string) {
  return db.query.characters.findMany({
    where: and(eq(characters.campaignId, campaignId), isNull(characters.archivedAt)),
    orderBy: (c, { asc }) => [asc(c.name)],
    with: { player: { columns: { id: true, displayName: true } } },
  });
}

export async function getPlayerCharacters(campaignId: string, playerId: string) {
  return db.query.characters.findMany({
    where: and(
      eq(characters.campaignId, campaignId),
      eq(characters.playerId, playerId)
    ),
    orderBy: (c, { asc }) => [asc(c.name)],
  });
}

export async function getCharacterById(id: string) {
  return db.query.characters.findFirst({
    where: eq(characters.id, id),
    with: { player: { columns: { id: true, displayName: true } } },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createCharacter(params: {
  campaignId: string;
  playerId: string;
  name: string;
  description?: string;
}): Promise<Character> {
  const [character] = await db
    .insert(characters)
    .values({
      campaignId: params.campaignId,
      playerId: params.playerId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
    })
    .returning();
  return character;
}

export async function updateCharacter(
  id: string,
  params: { name?: string; description?: string }
): Promise<Character> {
  const updates: Partial<Character> = {
    updatedAt: new Date(),
  };
  if (params.name !== undefined) updates.name = params.name.trim();
  if (params.description !== undefined)
    updates.description = params.description.trim() || null;

  const [character] = await db
    .update(characters)
    .set(updates)
    .where(eq(characters.id, id))
    .returning();
  return character;
}

export async function updateCharacterStatus(
  id: string,
  status: CharacterStatus
): Promise<Character> {
  const [character] = await db
    .update(characters)
    .set({ status, updatedAt: new Date() })
    .where(eq(characters.id, id))
    .returning();
  return character;
}

export async function archiveCharacter(id: string): Promise<Character> {
  const [character] = await db
    .update(characters)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(characters.id, id))
    .returning();
  return character;
}
