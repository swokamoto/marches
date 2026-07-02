import { db } from "../db/index.js";
import { activityLog } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";

export async function logActivity(params: {
  campaignId: string;
  actorId: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  gmOnly?: boolean;
}): Promise<void> {
  await db.insert(activityLog).values({
    campaignId: params.campaignId,
    actorId: params.actorId,
    actionType: params.actionType,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? null,
    gmOnly: params.gmOnly ?? false,
  });
}

export async function getRecentActivity(
  campaignId: string,
  viewerIsGm: boolean,
  limit = 20
) {
  const conditions = viewerIsGm
    ? eq(activityLog.campaignId, campaignId)
    : and(
        eq(activityLog.campaignId, campaignId),
        eq(activityLog.gmOnly, false)
      );

  return db.query.activityLog.findMany({
    where: conditions,
    orderBy: [desc(activityLog.occurredAt)],
    limit,
    with: {
      actor: { columns: { id: true, displayName: true } },
    },
  });
}

// ─── Human-readable label for an activity entry ───────────────────────────────

export function describeActivity(item: {
  actionType: string;
  entityType: string | null;
  metadata: unknown;
  actor: { displayName: string } | null;
}): string {
  const actor = item.actor?.displayName ?? "Someone";
  const meta = (item.metadata ?? {}) as Record<string, string>;

  switch (item.actionType) {
    case "expedition.created":
      return `${actor} created expedition "${meta.title ?? ""}"`;
    case "expedition.status_changed":
      return `${actor} moved expedition "${meta.title ?? ""}" to ${meta.status ?? ""}`;
    case "session.created":
      return `${actor} started a session for "${meta.expeditionTitle ?? ""}"`;
    case "session.report_published":
      return `${actor} published the report for "${meta.expeditionTitle ?? ""}"`;
    case "session.closed":
      return `${actor} closed session for "${meta.expeditionTitle ?? ""}"`;
    case "character.created":
      return `${actor} created character "${meta.name ?? ""}"`;
    case "character.archived":
      return `${actor} archived character "${meta.name ?? ""}"`;
    case "location.created":
      return `${actor} added location "${meta.name ?? ""}"`;
    case "location.archived":
      return `${actor} archived location "${meta.name ?? ""}"`;
    case "npc.created":
      return `${actor} added NPC "${meta.name ?? ""}"`;
    case "npc.archived":
      return `${actor} archived NPC "${meta.name ?? ""}"`;
    case "artifact.created":
      return `${actor} added artifact "${meta.name ?? ""}"`;
    case "artifact.archived":
      return `${actor} archived artifact "${meta.name ?? ""}"`;
    case "member.joined":
      return `${actor} joined the campaign`;
    case "world_event.created":
      return `World event: "${meta.title ?? ""}"`;
    default:
      return `${actor} performed ${item.actionType}`;
  }
}
