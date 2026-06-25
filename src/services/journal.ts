import { db } from "../db/index.js";
import { journalEntries } from "../db/schema.js";
import { eq, and, desc, asc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type JournalEntry = InferSelectModel<typeof journalEntries>;
export type JournalVisibility = JournalEntry["visibility"];
export type JournalEntityType = JournalEntry["entityType"];

// ─── Queries ──────────────────────────────────────────────────────────────────

// Returns entries the requesting user is allowed to see.
// - 'private' entries: only their own
// - 'gm_only' entries: only if their role is gm or admin
// - 'public': everyone
export async function getJournalEntries(
  campaignId: string,
  entityType: JournalEntityType,
  entityId: string,
  viewerId: string,
  viewerRole: string
) {
  const all = await db.query.journalEntries.findMany({
    where: and(
      eq(journalEntries.campaignId, campaignId),
      eq(journalEntries.entityType, entityType),
      eq(journalEntries.entityId, entityId)
    ),
    with: {
      author: {
        columns: { id: true, displayName: true },
      },
    },
    orderBy: [desc(journalEntries.pinned), asc(journalEntries.createdAt)],
  });

  return all.filter((entry) => {
    if (entry.visibility === "public") return true;
    if (entry.visibility === "private") return entry.authorId === viewerId;
    if (entry.visibility === "gm_only")
      return viewerRole === "gm" || viewerRole === "admin";
    return false;
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createJournalEntry(params: {
  campaignId: string;
  authorId: string;
  authorRole: JournalEntry["authorRole"];
  entityType: JournalEntityType;
  entityId: string;
  body: string;
  visibility: JournalVisibility;
  campaignDay?: number;
  pinned?: boolean;
}) {
  const [entry] = await db
    .insert(journalEntries)
    .values({
      campaignId: params.campaignId,
      authorId: params.authorId,
      authorRole: params.authorRole,
      entityType: params.entityType,
      entityId: params.entityId,
      body: params.body.trim(),
      visibility: params.visibility,
      campaignDay: params.campaignDay,
      pinned: params.pinned ?? false,
    })
    .returning();

  return entry;
}

export async function pinJournalEntry(entryId: string) {
  await db
    .update(journalEntries)
    .set({ pinned: true, updatedAt: new Date() })
    .where(eq(journalEntries.id, entryId));
}
