import { db } from "../db/index.js";
import { npcs } from "../db/schema.js";
import { eq, and, isNull, ilike, count } from "drizzle-orm";
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

export async function getNpcsPaginated(campaignId: string, page = 1) {
  const offset = (page - 1) * NPCS_PER_PAGE;
  const [rows, [{ total }]] = await Promise.all([
    db.query.npcs.findMany({
      where: and(eq(npcs.campaignId, campaignId), isNull(npcs.archivedAt)),
      with: { location: { columns: { id: true, name: true } } },
      orderBy: (n, { asc }) => [asc(n.name)],
      limit: NPCS_PER_PAGE,
      offset,
    }),
    db.select({ total: count() }).from(npcs)
      .where(and(eq(npcs.campaignId, campaignId), isNull(npcs.archivedAt))),
  ]);
  return { npcs: rows, total: Number(total), page, totalPages: Math.ceil(Number(total) / NPCS_PER_PAGE) };
}

export async function getNpcById(id: string) {
  return db.query.npcs.findFirst({ where: eq(npcs.id, id) });
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
  description?: string
) {
  const [npc] = await db
    .insert(npcs)
    .values({ campaignId, name: name.trim(), description: description?.trim() || null, createdBy })
    .returning();
  return npc;
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
    with: { location: { columns: { id: true, name: true } } },
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
