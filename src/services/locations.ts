import { db } from "../db/index.js";
import { locations, locationConnections } from "../db/schema.js";
import { eq, and, isNull, ilike } from "drizzle-orm";
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

export async function getLocations(campaignId: string) {
  return db.query.locations.findMany({
    where: and(eq(locations.campaignId, campaignId), isNull(locations.archivedAt)),
    orderBy: (l, { asc }) => [asc(l.name)],
  });
}

export async function getLocationBySlug(campaignId: string, slug: string) {
  return db.query.locations.findFirst({
    where: and(
      eq(locations.campaignId, campaignId),
      eq(locations.slug, slug)
    ),
    with: {
      parent: { columns: { id: true, name: true, slug: true } },
      children: {
        where: isNull(locations.archivedAt),
        columns: { id: true, name: true, slug: true, status: true },
      },
      connectionsFrom: {
        with: { toLocation: { columns: { id: true, name: true, slug: true, status: true } } },
      },
    },
  });
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
  parentLocationId?: string
) {
  const slug = await uniqueLocationSlug(campaignId, slugify(name));

  const [location] = await db
    .insert(locations)
    .values({ campaignId, name: name.trim(), slug, createdBy, parentLocationId: parentLocationId || null })
    .returning();

  return location;
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
  await db
    .insert(locationConnections)
    .values({ fromLocationId, toLocationId, description: description?.trim() || null })
    .onConflictDoNothing();
}

export async function removeLocationConnection(connectionId: string) {
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
