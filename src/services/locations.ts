import { db } from "../db/index.js";
import { locations, locationConnections } from "../db/schema.js";
import { eq, and, isNull, ilike, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { slugify } from "../utils/slugify.js";

export type Location = InferSelectModel<typeof locations>;
export type LocationStatus = Location["status"];

// ─── Slug ─────────────────────────────────────────────────────────────────────

async function uniqueLocationSlug(
  campaignId: string,
  base: string
): Promise<string> {
  const safeBase = base || "untitled";
  let slug = safeBase;
  let i = 2;
  while (true) {
    const existing = await db.query.locations.findFirst({
      where: and(
        eq(locations.campaignId, campaignId),
        eq(locations.slug, slug)
      ),
      columns: { id: true },
    });
    if (!existing) return slug;
    slug = `${safeBase}-${i++}`;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getLocations(campaignId: string, isGm = true) {
  const baseWhere = and(eq(locations.campaignId, campaignId), isNull(locations.archivedAt));
  const whereClause = isGm ? baseWhere : and(baseWhere, eq(locations.revealed, true));
  return db.query.locations.findMany({
    where: whereClause,
    orderBy: (l, { asc }) => [asc(l.name)],
  });
}

export async function getLocationBySlug(campaignId: string, slug: string, isGm = true) {
  const result = await db.query.locations.findFirst({
    where: and(
      eq(locations.campaignId, campaignId),
      eq(locations.slug, slug)
    ),
    with: {
      parent: { columns: { id: true, name: true, slug: true } },
      children: {
        where: (l, { isNull, and }) => isGm
          ? isNull(l.archivedAt)
          : and(isNull(l.archivedAt), sql`${l.revealed} = true`),
        columns: { id: true, name: true, slug: true, status: true },
      },
      connectionsFrom: {
        with: { toLocation: { columns: { id: true, name: true, slug: true, status: true, revealed: true } } },
      },
      npcs: {
        where: (n, { isNull, and }) => isGm
          ? isNull(n.archivedAt)
          : and(isNull(n.archivedAt), sql`${n.revealed} = true`),
        columns: { id: true, name: true, status: true },
        orderBy: (n, { asc }) => [asc(n.name)],
      },
      artifacts: {
        where: (a, { isNull, and }) => isGm
          ? isNull(a.archivedAt)
          : and(isNull(a.archivedAt), sql`${a.revealed} = true`),
        columns: { id: true, name: true, status: true },
        orderBy: (a, { asc }) => [asc(a.name)],
      },
    },
  });
  if (!result) return result;
  if (!isGm) {
    return {
      ...result,
      connectionsFrom: result.connectionsFrom.filter(c => c.toLocation.revealed),
    };
  }
  return result;
}

export async function getLocationById(id: string) {
  return db.query.locations.findFirst({
    where: eq(locations.id, id),
  });
}

export async function searchLocations(campaignId: string, query: string) {
  return db.query.locations.findMany({
    where: and(
      eq(locations.campaignId, campaignId),
      isNull(locations.archivedAt),
      ilike(locations.name, `%${query}%`)
    ),
    columns: { id: true, name: true, slug: true, status: true },
    limit: 10,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createLocation(
  campaignId: string,
  name: string,
  createdBy: string,
  parentLocationId?: string,
  revealed = false
) {
  const slug = await uniqueLocationSlug(campaignId, slugify(name));

  const [location] = await db
    .insert(locations)
    .values({ campaignId, name: name.trim(), slug, createdBy, parentLocationId: parentLocationId || null, revealed })
    .returning();

  return location;
}

export async function updateLocationRevealed(locationId: string, revealed: boolean) {
  const [updated] = await db
    .update(locations)
    .set({ revealed, updatedAt: new Date() })
    .where(eq(locations.id, locationId))
    .returning();
  return updated;
}

export async function updateLocationParent(
  locationId: string,
  parentLocationId: string | null
) {
  const [updated] = await db
    .update(locations)
    .set({ parentLocationId, updatedAt: new Date() })
    .where(eq(locations.id, locationId))
    .returning();
  return updated;
}

export async function addLocationConnection(
  fromLocationId: string,
  toLocationId: string,
  description?: string
) {
  const desc = description?.trim() || null;
  await db
    .insert(locationConnections)
    .values([
      { fromLocationId, toLocationId, description: desc },
      { fromLocationId: toLocationId, toLocationId: fromLocationId, description: desc },
    ])
    .onConflictDoNothing();
}

export async function removeLocationConnection(connectionId: string) {
  // Look up the connection first so we can also delete the reverse.
  const conn = await db.query.locationConnections.findFirst({
    where: eq(locationConnections.id, connectionId),
  });
  if (!conn) return;
  await db
    .delete(locationConnections)
    .where(
      and(
        eq(locationConnections.fromLocationId, conn.toLocationId),
        eq(locationConnections.toLocationId, conn.fromLocationId)
      )
    );
  await db
    .delete(locationConnections)
    .where(eq(locationConnections.id, connectionId));
}

export async function updateLocationStatus(
  locationId: string,
  status: LocationStatus
) {
  const [updated] = await db
    .update(locations)
    .set({ status, updatedAt: new Date() })
    .where(eq(locations.id, locationId))
    .returning();

  return updated;
}

export async function archiveLocation(locationId: string) {
  const [updated] = await db
    .update(locations)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(locations.id, locationId))
    .returning();
  return updated;
}
