import { db } from "../db/index.js";
import {
  worldChanges,
  worldEvents,
  sessionReports,
  locations,
  npcs,
  artifacts,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type WorldChange = InferSelectModel<typeof worldChanges>;
export type WorldChangeType = WorldChange["changeType"];

// ─── World Changes ────────────────────────────────────────────────────────────

export async function addWorldChange(params: {
  sessionReportId: string;
  changeType: WorldChangeType;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}) {
  const [change] = await db
    .insert(worldChanges)
    .values({
      sessionReportId: params.sessionReportId,
      changeType: params.changeType,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description.trim(),
      metadata: params.metadata ?? null,
      createdBy: params.createdBy,
    })
    .returning();
  return change;
}

export async function removeWorldChange(changeId: string, reportId: string) {
  await db
    .delete(worldChanges)
    .where(
      and(
        eq(worldChanges.id, changeId),
        eq(worldChanges.sessionReportId, reportId),
        eq(worldChanges.status, "pending") // cannot remove published changes
      )
    );
}

// ─── Publish ──────────────────────────────────────────────────────────────────
// Converts all pending world changes on a report into world events,
// applies entity status updates, and marks the report published.
// Runs as a sequential set of writes — not a DB transaction (postgres.js
// supports transactions but keeping it simple for v1; worst case is a
// partial publish that the admin can correct).

export async function publishReport(
  reportId: string,
  sessionId: string,
  campaignId: string,
  campaignDay: number | undefined,
  publisherId: string
) {
  const report = await db.query.sessionReports.findFirst({
    where: eq(sessionReports.id, reportId),
    with: { worldChanges: true },
  });

  if (!report || report.status === "published") {
    throw new Error("Report not found or already published.");
  }

  const pending = report.worldChanges.filter((c) => c.status === "pending");

  for (const change of pending) {
    // 1. Create world event
    await db.insert(worldEvents).values({
      campaignId,
      sessionId,
      worldChangeId: change.id,
      title: change.description,
      description: change.description,
      campaignDay,
      createdBy: publisherId,
    });

    // 2. Apply entity status update if applicable
    const meta = change.metadata as Record<string, string> | null;

    if (change.changeType === "location_status_change" && change.entityId && meta?.new_status) {
      await db
        .update(locations)
        .set({ status: meta.new_status as InferSelectModel<typeof locations>["status"], updatedAt: new Date() })
        .where(eq(locations.id, change.entityId));
    }

    if (change.changeType === "npc_status_change" && change.entityId && meta?.new_status) {
      await db
        .update(npcs)
        .set({ status: meta.new_status as InferSelectModel<typeof npcs>["status"], updatedAt: new Date() })
        .where(eq(npcs.id, change.entityId));
    }

    if (change.changeType === "npc_defeated" && change.entityId) {
      await db
        .update(npcs)
        .set({ status: "dead", updatedAt: new Date() })
        .where(eq(npcs.id, change.entityId));
    }

    // 3. Mark change published
    await db
      .update(worldChanges)
      .set({ status: "published" })
      .where(eq(worldChanges.id, change.id));
  }

  // 4. Mark report published
  await db
    .update(sessionReports)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(sessionReports.id, reportId));
}
