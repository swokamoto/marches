import { db } from "../db/index.js";
import { locations } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Location = InferSelectModel<typeof locations>;
export type LocationStatus = Location["status"];

// ─── Slug ─────────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 60);
}

async function uniqueLocationSlug(
  campaignId: string,
  base: string
): Promise<string> {
  let slug = base;
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
    slug = `${base}-${i++}`;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getLocations(campaignId: string) {
  return db.query.locations.findMany({
    where: eq(locations.campaignId, campaignId),
    orderBy: (l, { asc }) => [asc(l.name)],
  });
}

export async function getLocationBySlug(campaignId: string, slug: string) {
  return db.query.locations.findFirst({
    where: and(
      eq(locations.campaignId, campaignId),
      eq(locations.slug, slug)
    ),
  });
}

export async function getLocationById(id: string) {
  return db.query.locations.findFirst({
    where: eq(locations.id, id),
  });
}

// Search by name prefix — used for check-or-create autocomplete
export async function searchLocations(campaignId: string, query: string) {
  const all = await db.query.locations.findMany({
    where: eq(locations.campaignId, campaignId),
    columns: { id: true, name: true, slug: true, status: true },
  });
  const q = query.toLowerCase();
  return all.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 10);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createLocation(
  campaignId: string,
  name: string,
  createdBy: string
) {
  const slug = await uniqueLocationSlug(campaignId, slugify(name));

  const [location] = await db
    .insert(locations)
    .values({ campaignId, name: name.trim(), slug, createdBy })
    .returning();

  return location;
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
