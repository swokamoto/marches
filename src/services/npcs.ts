import { db } from "../db/index.js";
import { npcs } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Npc = InferSelectModel<typeof npcs>;
export type NpcStatus = Npc["status"];

export async function getNpcs(campaignId: string) {
  return db.query.npcs.findMany({
    where: eq(npcs.campaignId, campaignId),
    orderBy: (n, { asc }) => [asc(n.name)],
  });
}

export async function getNpcById(id: string) {
  return db.query.npcs.findFirst({ where: eq(npcs.id, id) });
}

export async function searchNpcs(campaignId: string, query: string) {
  const all = await db.query.npcs.findMany({
    where: eq(npcs.campaignId, campaignId),
    columns: { id: true, name: true, status: true },
  });
  const q = query.toLowerCase();
  return all.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 10);
}

export async function createNpc(
  campaignId: string,
  name: string,
  createdBy: string
) {
  const [npc] = await db
    .insert(npcs)
    .values({ campaignId, name: name.trim(), createdBy })
    .returning();
  return npc;
}

export async function updateNpcStatus(npcId: string, status: NpcStatus) {
  const [updated] = await db
    .update(npcs)
    .set({ status, updatedAt: new Date() })
    .where(eq(npcs.id, npcId))
    .returning();
  return updated;
}
