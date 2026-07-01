import { db } from "../db/index.js";
import { activityLog } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export async function logActivity(params: {
  campaignId: string;
  actorId: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(activityLog).values({
    campaignId: params.campaignId,
    actorId: params.actorId,
    actionType: params.actionType,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function getRecentActivity(campaignId: string, limit = 20) {
  return db.query.activityLog.findMany({
    where: eq(activityLog.campaignId, campaignId),
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
    case "location.created":
      return `${actor} added location "${meta.name ?? ""}"`;
    case "npc.created":
      return `${actor} added NPC "${meta.name ?? ""}"`;
    case "artifact.created":
      return `${actor} added artifact "${meta.name ?? ""}"`;
    case "world_event.created":
      return `World event: "${meta.title ?? ""}"`;
    default:
      return `${actor} performed ${item.actionType}`;
  }
}
