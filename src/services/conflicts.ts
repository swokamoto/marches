import { db } from "../db/index.js";
import {
  expeditions,
  expeditionNpcs,
  expeditionLocations,
} from "../db/schema.js";
import { eq, and, ne, inArray } from "drizzle-orm";

export interface Conflict {
  type: "npc" | "location";
  entityName: string;
  entityId: string;
  conflictingExpeditions: Array<{
    id: string;
    title: string;
    gmName: string;
    scheduledDate: Date | null;
  }>;
}

// Returns conflicts for a given expedition:
// other active/scheduled/recruiting expeditions that share NPCs or locations.
export async function detectConflicts(expeditionId: string): Promise<Conflict[]> {
  const expedition = await db.query.expeditions.findFirst({
    where: eq(expeditions.id, expeditionId),
    with: {
      npcs: { with: { npc: true } },
      locations: { with: { location: true } },
    },
  });

  if (!expedition) return [];

  const activeStatuses = ["recruiting", "scheduled", "active"];
  const conflicts: Conflict[] = [];

  // ── NPC conflicts ──────────────────────────────────────────────────────────

  for (const en of expedition.npcs) {
    const otherExpeditionNpcs = await db.query.expeditionNpcs.findMany({
      where: and(
        eq(expeditionNpcs.npcId, en.npc.id),
        ne(expeditionNpcs.expeditionId, expeditionId)
      ),
      with: {
        expedition: {
          with: { gm: { columns: { id: true, displayName: true } } },
        },
      },
    });

    const conflicting = otherExpeditionNpcs.filter((o) =>
      activeStatuses.includes(o.expedition.status)
    );

    if (conflicting.length > 0) {
      conflicts.push({
        type: "npc",
        entityName: en.npc.name,
        entityId: en.npc.id,
        conflictingExpeditions: conflicting.map((o) => ({
          id: o.expedition.id,
          title: o.expedition.title,
          gmName: o.expedition.gm.displayName,
          scheduledDate: o.expedition.scheduledDate,
        })),
      });
    }
  }

  // ── Location conflicts ─────────────────────────────────────────────────────

  for (const el of expedition.locations) {
    const otherExpeditionLocations = await db.query.expeditionLocations.findMany({
      where: and(
        eq(expeditionLocations.locationId, el.location.id),
        ne(expeditionLocations.expeditionId, expeditionId)
      ),
      with: {
        expedition: {
          with: { gm: { columns: { id: true, displayName: true } } },
        },
      },
    });

    const conflicting = otherExpeditionLocations.filter((o) =>
      activeStatuses.includes(o.expedition.status)
    );

    if (conflicting.length > 0) {
      conflicts.push({
        type: "location",
        entityName: el.location.name,
        entityId: el.location.id,
        conflictingExpeditions: conflicting.map((o) => ({
          id: o.expedition.id,
          title: o.expedition.title,
          gmName: o.expedition.gm.displayName,
          scheduledDate: o.expedition.scheduledDate,
        })),
      });
    }
  }

  return conflicts;
}
