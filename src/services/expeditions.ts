import { db } from "../db/index.js";
import {
  expeditions,
  expeditionLocations,
  expeditionNpcs,
  expeditionArtifacts,
  expeditionParticipants,
  characters,
} from "../db/schema.js";
import { eq, and, count } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Expedition = InferSelectModel<typeof expeditions>;
export type ExpeditionStatus = Expedition["status"];

export const EXPEDITIONS_PER_PAGE = 20;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getExpeditions(campaignId: string, page = 1) {
  const offset = (page - 1) * EXPEDITIONS_PER_PAGE;
  const [rows, [{ total }]] = await Promise.all([
    db.query.expeditions.findMany({
      where: eq(expeditions.campaignId, campaignId),
      with: { gm: { columns: { id: true, displayName: true } } },
      orderBy: (e, { desc }) => [desc(e.createdAt)],
      limit: EXPEDITIONS_PER_PAGE,
      offset,
    }),
    db.select({ total: count() }).from(expeditions).where(eq(expeditions.campaignId, campaignId)),
  ]);
  return {
    expeditions: rows,
    total: Number(total),
    page,
    totalPages: Math.ceil(Number(total) / EXPEDITIONS_PER_PAGE),
  };
}

export async function getExpeditionById(id: string) {
  return db.query.expeditions.findFirst({
    where: eq(expeditions.id, id),
    with: {
      gm: { columns: { id: true, displayName: true } },
      locations: { with: { location: true } },
      npcs: { with: { npc: true } },
      artifacts: { with: { artifact: true } },
      participants: {
        with: {
          character: {
            with: { player: { columns: { id: true, displayName: true } } },
          },
        },
      },
    },
  });
}

export async function getPlayerCharactersForCampaign(
  campaignId: string,
  playerId: string
) {
  return db.query.characters.findMany({
    where: and(
      eq(characters.campaignId, campaignId),
      eq(characters.playerId, playerId),
      eq(characters.status, "active")
    ),
    columns: { id: true, name: true },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createExpedition(params: {
  campaignId: string;
  gmId: string;
  title: string;
  premise?: string;
  scheduledDate?: Date;
}) {
  const [expedition] = await db
    .insert(expeditions)
    .values({
      campaignId: params.campaignId,
      gmId: params.gmId,
      title: params.title.trim(),
      premise: params.premise?.trim(),
      scheduledDate: params.scheduledDate,
    })
    .returning();
  return expedition;
}

export async function updateExpeditionStatus(
  expeditionId: string,
  status: ExpeditionStatus
) {
  const [updated] = await db
    .update(expeditions)
    .set({ status, updatedAt: new Date() })
    .where(eq(expeditions.id, expeditionId))
    .returning();
  return updated;
}

// ─── Entity linking ───────────────────────────────────────────────────────────

export async function addExpeditionLocation(
  expeditionId: string,
  locationId: string
) {
  await db
    .insert(expeditionLocations)
    .values({ expeditionId, locationId })
    .onConflictDoNothing();
}

export async function removeExpeditionLocation(
  expeditionId: string,
  locationId: string
) {
  await db
    .delete(expeditionLocations)
    .where(
      and(
        eq(expeditionLocations.expeditionId, expeditionId),
        eq(expeditionLocations.locationId, locationId)
      )
    );
}

export async function addExpeditionNpc(expeditionId: string, npcId: string) {
  await db
    .insert(expeditionNpcs)
    .values({ expeditionId, npcId })
    .onConflictDoNothing();
}

export async function removeExpeditionNpc(expeditionId: string, npcId: string) {
  await db
    .delete(expeditionNpcs)
    .where(
      and(
        eq(expeditionNpcs.expeditionId, expeditionId),
        eq(expeditionNpcs.npcId, npcId)
      )
    );
}

export async function addExpeditionArtifact(
  expeditionId: string,
  artifactId: string
) {
  await db
    .insert(expeditionArtifacts)
    .values({ expeditionId, artifactId })
    .onConflictDoNothing();
}

export async function removeExpeditionArtifact(
  expeditionId: string,
  artifactId: string
) {
  await db
    .delete(expeditionArtifacts)
    .where(
      and(
        eq(expeditionArtifacts.expeditionId, expeditionId),
        eq(expeditionArtifacts.artifactId, artifactId)
      )
    );
}

// ─── Participants ─────────────────────────────────────────────────────────────

export async function addExpeditionParticipant(
  expeditionId: string,
  characterId: string
) {
  await db
    .insert(expeditionParticipants)
    .values({ expeditionId, characterId })
    .onConflictDoNothing();
}

export async function removeExpeditionParticipant(
  expeditionId: string,
  characterId: string
) {
  await db
    .delete(expeditionParticipants)
    .where(
      and(
        eq(expeditionParticipants.expeditionId, expeditionId),
        eq(expeditionParticipants.characterId, characterId)
      )
    );
}
