import { db } from "../db/index.js";
import { npcs } from "../db/schema.js";
import { eq, and, isNull, ilike, count, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Npc = InferSelectModel<typeof npcs>;
export type NpcStatus = Npc["status"];

export const NPCS_PER_PAGE = 30;

export async function getNpcs(campaignId: string) {
  return db.query.npcs.findMany({
    where: and(eq(npcs.campaignId, campaignId), isNull(npcs.archivedAt)),
    orderBy: (n, { asc }) => [asc(n.name)],
  });
}

export async function getNpcsPaginated(campaignId: string, page = 1, isGm = true) {
  const offset = (page - 1) * NPCS_PER_PAGE;
  const baseWhere = and(eq(npcs.campaignId, campaignId), isNull(npcs.archivedAt));
  const whereClause = isGm ? baseWhere : and(baseWhere, eq(npcs.revealed, true));
  const [rows, [{ total }]] = await Promise.all([
    db.query.npcs.findMany({
      where: whereClause,
      with: {
        location: { columns: { id: true, name: true } },
        faction: { columns: { id: true, name: true } },
      },
      orderBy: (n, { asc }) => [asc(n.name)],
      limit: NPCS_PER_PAGE,
      offset,
    }),
    db.select({ total: count() }).from(npcs).where(whereClause),
  ]);
  return { npcs: rows, total: Number(total), page, totalPages: Math.ceil(Number(total) / NPCS_PER_PAGE) };
}

export async function getNpcById(id: string, isGm = true) {
  return db.query.npcs.findFirst({
    where: eq(npcs.id, id),
    with: {
      faction: { columns: { id: true, name: true } },
      artifacts: {
        where: (a, { isNull, and }) => isGm
          ? isNull(a.archivedAt)
          : and(isNull(a.archivedAt), sql`${a.revealed} = true`),
        columns: { id: true, name: true, status: true },
        orderBy: (a, { asc }) => [asc(a.name)],
      },
    },
  });
}

export async function searchNpcs(campaignId: string, query: string) {
  return db.query.npcs.findMany({
    where: and(
      eq(npcs.campaignId, campaignId),
      isNull(npcs.archivedAt),
      ilike(npcs.name, `%${query}%`)
    ),
    columns: { id: true, name: true, status: true },
    limit: 10,
  });
}

export async function createNpc(
  campaignId: string,
  name: string,
  createdBy: string,
  description?: string,
  factionId?: string | null,
  revealed = false
) {
  const [npc] = await db
    .insert(npcs)
    .values({
      campaignId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy,
      factionId: factionId || null,
      revealed,
    })
    .returning();
  return npc;
}

export async function updateNpcRevealed(npcId: string, revealed: boolean) {
  const [updated] = await db
    .update(npcs)
    .set({ revealed, updatedAt: new Date() })
    .where(eq(npcs.id, npcId))
    .returning();
  return updated;
}

export async function updateNpcFaction(
  npcId: string,
  factionId: string | null
) {
  const [updated] = await db
    .update(npcs)
    .set({ factionId, updatedAt: new Date() })
    .where(eq(npcs.id, npcId))
    .returning();
  return updated;
}

export async function updateNpc(
  npcId: string,
  params: { description?: string }
) {
  const [updated] = await db
    .update(npcs)
    .set({ description: params.description?.trim() || null, updatedAt: new Date() })
    .where(eq(npcs.id, npcId))
    .returning();
  return updated;
}

export async function updateNpcStatus(npcId: string, status: NpcStatus) {
  const [updated] = await db
    .update(npcs)
    .set({ status, updatedAt: new Date() })
    .where(eq(npcs.id, npcId))
    .returning();
  return updated;
}

export async function updateNpcLocation(
  npcId: string,
  locationId: string | null
) {
  const [updated] = await db
    .update(npcs)
    .set({ locationId, updatedAt: new Date() })
    .where(eq(npcs.id, npcId))
    .returning();
  return updated;
}

export async function getNpcsWithLocation(campaignId: string) {
  return db.query.npcs.findMany({
    where: and(eq(npcs.campaignId, campaignId), isNull(npcs.archivedAt)),
    orderBy: (n, { asc }) => [asc(n.name)],
    with: {
      location: { columns: { id: true, name: true } },
      faction: { columns: { id: true, name: true } },
    },
  });
}

export async function archiveNpc(npcId: string) {
  const [updated] = await db
    .update(npcs)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(npcs.id, npcId))
    .returning();
  return updated;
}
