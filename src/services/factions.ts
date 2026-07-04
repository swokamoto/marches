import { db } from "../db/index.js";
import { factions } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Faction = InferSelectModel<typeof factions>;
export type FactionStatus = Faction["status"];

export async function getFactions(campaignId: string) {
  return db.query.factions.findMany({
    where: and(eq(factions.campaignId, campaignId), isNull(factions.archivedAt)),
    orderBy: (f, { asc }) => [asc(f.name)],
  });
}

export async function getFactionById(id: string) {
  return db.query.factions.findFirst({
    where: eq(factions.id, id),
    with: {
      npcs: {
        where: (n, { isNull }) => isNull(n.archivedAt),
        columns: { id: true, name: true, status: true },
        orderBy: (n, { asc }) => [asc(n.name)],
      },
    },
  });
}

export async function createFaction(
  campaignId: string,
  name: string,
  createdBy: string,
  description?: string
) {
  const [faction] = await db
    .insert(factions)
    .values({ campaignId, name: name.trim(), description: description?.trim() || null, createdBy })
    .returning();
  return faction;
}

export async function updateFaction(
  factionId: string,
  params: { description?: string }
) {
  const [updated] = await db
    .update(factions)
    .set({ description: params.description?.trim() || null, updatedAt: new Date() })
    .where(eq(factions.id, factionId))
    .returning();
  return updated;
}

export async function updateFactionStatus(factionId: string, status: FactionStatus) {
  const [updated] = await db
    .update(factions)
    .set({ status, updatedAt: new Date() })
    .where(eq(factions.id, factionId))
    .returning();
  return updated;
}

export async function archiveFaction(factionId: string) {
  const [updated] = await db
    .update(factions)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(factions.id, factionId))
    .returning();
  return updated;
}
