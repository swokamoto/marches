import { db } from "../db/index.js";
import {
  sessions,
  sessionParticipants,
  sessionReports,
  sessionPlayerNotes,
  expeditions,
  characters,
} from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Session = InferSelectModel<typeof sessions>;
export type SessionStatus = Session["status"];

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSessionById(id: string) {
  return db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: {
      gm: { columns: { id: true, displayName: true } },
      expedition: true,
      participants: {
        with: {
          character: {
            with: { player: { columns: { id: true, displayName: true } } },
          },
        },
      },
      report: {
        with: { worldChanges: true },
      },
      playerNotes: {
        with: { player: { columns: { id: true, displayName: true } } },
      },
    },
  });
}

export async function getSessionsForCampaign(campaignId: string) {
  return db.query.sessions.findMany({
    where: eq(sessions.campaignId, campaignId),
    with: {
      gm: { columns: { id: true, displayName: true } },
      expedition: { columns: { id: true, title: true } },
    },
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });
}

export async function getSessionsForExpedition(expeditionId: string) {
  return db.query.sessions.findMany({
    where: eq(sessions.expeditionId, expeditionId),
    with: { gm: { columns: { id: true, displayName: true } } },
    orderBy: (s, { asc }) => [asc(s.createdAt)],
  });
}

/**
 * Returns sessions (with expedition info) that any of the given user's
 * characters are participating in, scoped to a campaign.
 */
export async function getPlayerSessionsForCampaign(campaignId: string, userId: string) {
  // Find this player's characters in the campaign
  const playerChars = await db.query.characters.findMany({
    where: and(
      eq(characters.campaignId, campaignId),
      eq(characters.playerId, userId)
    ),
    columns: { id: true, name: true },
  });

  if (playerChars.length === 0) return [];

  const charIds = playerChars.map((c) => c.id);

  // Find session participants rows for those characters
  const rows = await db.query.sessionParticipants.findMany({
    where: inArray(sessionParticipants.characterId, charIds),
    with: {
      session: {
        with: {
          expedition: { columns: { id: true, title: true, status: true } },
        },
      },
    },
  });

  // Attach character name and return, deduplicated by sessionId
  const seen = new Set<string>();
  const result: Array<{
    sessionId: string;
    characterId: string;
    characterName: string;
    session: (typeof rows)[number]["session"];
  }> = [];

  for (const row of rows) {
    if (seen.has(row.session.id)) continue;
    seen.add(row.session.id);
    const char = playerChars.find((c) => c.id === row.characterId)!;
    result.push({
      sessionId: row.session.id,
      characterId: row.characterId,
      characterName: char.name,
      session: row.session,
    });
  }

  // Sort: active expeditions first, then by session id (creation order proxy)
  const statusOrder: Record<string, number> = { active: 0, scheduled: 1, recruiting: 2, completed: 3, cancelled: 4 };
  result.sort((a, b) => (statusOrder[a.session.expedition.status] ?? 9) - (statusOrder[b.session.expedition.status] ?? 9));

  return result;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createSession(params: {
  expeditionId: string;
  gmId: string;
  campaignId: string;
  campaignDay?: number;
  playedAt?: Date;
}) {
  const [session] = await db
    .insert(sessions)
    .values({
      expeditionId: params.expeditionId,
      gmId: params.gmId,
      campaignId: params.campaignId,
      campaignDay: params.campaignDay,
      playedAt: params.playedAt ?? new Date(),
    })
    .returning();

  // Copy expedition participants into the session
  const expedition = await db.query.expeditions.findFirst({
    where: eq(expeditions.id, params.expeditionId),
    with: { participants: true },
  });

  if (expedition?.participants.length) {
    await db.insert(sessionParticipants).values(
      expedition.participants.map((p) => ({
        sessionId: session.id,
        characterId: p.characterId,
      }))
    );
  }

  return session;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
) {
  const [updated] = await db
    .update(sessions)
    .set({ status, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();
  return updated;
}

export async function updateSessionSchedule(
  sessionId: string,
  campaignDay: number | null,
  playedAt: Date | null
) {
  const [updated] = await db
    .update(sessions)
    .set({ campaignDay, playedAt, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId))
    .returning();
  return updated;
}

export async function addSessionParticipant(sessionId: string, characterId: string) {
  await db
    .insert(sessionParticipants)
    .values({ sessionId, characterId })
    .onConflictDoNothing();
}

export async function removeSessionParticipant(sessionId: string, characterId: string) {
  await db
    .delete(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.characterId, characterId)
      )
    );
}

// ─── Session report ───────────────────────────────────────────────────────────

export async function getOrCreateReport(sessionId: string, authorId: string) {
  const existing = await db.query.sessionReports.findFirst({
    where: eq(sessionReports.sessionId, sessionId),
    with: { worldChanges: true },
  });

  if (existing) return existing;

  const [report] = await db
    .insert(sessionReports)
    .values({ sessionId, authorId })
    .returning();

  return { ...report, worldChanges: [] };
}

// ─── Player notes ─────────────────────────────────────────────────────────────

export async function submitPlayerNote(
  sessionId: string,
  playerId: string,
  characterId: string | undefined,
  body: string
) {
  // Upsert — one note per player per session (unique constraint enforced by DB)
  const [note] = await db
    .insert(sessionPlayerNotes)
    .values({ sessionId, playerId, characterId, body })
    .onConflictDoUpdate({
      target: [sessionPlayerNotes.sessionId, sessionPlayerNotes.playerId],
      set: { body, submittedAt: new Date() },
    })
    .returning();
  return note;
}

// Check if a user is a participant in a session (via their characters)
export async function isSessionParticipant(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: {
      participants: {
        with: {
          character: { columns: { id: true, playerId: true } },
        },
      },
    },
  });

  if (!session) return false;
  return session.participants.some((p) => p.character.playerId === userId);
}
