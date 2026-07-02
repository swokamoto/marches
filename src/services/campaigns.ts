import { db } from "../db/index.js";
import { campaigns, campaignMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

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

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || "untitled";
  let i = 2;
  while (true) {
    const existing = await db.query.campaigns.findFirst({
      where: eq(campaigns.slug, slug),
      columns: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${i++}`;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCampaignBySlug(slug: string) {
  return db.query.campaigns.findFirst({
    where: eq(campaigns.slug, slug),
  });
}

export async function getUserCampaigns(userId: string) {
  const memberships = await db.query.campaignMembers.findMany({
    where: eq(campaignMembers.userId, userId),
    with: { campaign: true },
  });
  return memberships.map((m) => ({
    id: m.campaign.id,
    slug: m.campaign.slug,
    name: m.campaign.name,
    description: m.campaign.description,
    createdAt: m.campaign.createdAt,
    role: m.role,
  }));
}

export async function getCampaignMember(campaignId: string, userId: string) {
  return db.query.campaignMembers.findFirst({
    where: and(
      eq(campaignMembers.campaignId, campaignId),
      eq(campaignMembers.userId, userId)
    ),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Returns the in-world day number (1-based) relative to when the campaign started. */
export function calcCampaignDay(campaignCreatedAt: Date, at: Date = new Date()): number {
  return Math.floor((at.getTime() - campaignCreatedAt.getTime()) / 86_400_000) + 1;
}

export async function createCampaign(
  name: string,
  description: string | undefined,
  createdBy: string
) {
  const slug = await uniqueSlug(slugify(name));

  const [campaign] = await db
    .insert(campaigns)
    .values({ name: name.trim(), slug, description: description?.trim(), createdBy })
    .returning();

  // Creator is automatically an admin member
  await db.insert(campaignMembers).values({
    campaignId: campaign.id,
    userId: createdBy,
    role: "admin",
  });

  return campaign;
}

export async function updateCampaign(
  campaignId: string,
  params: { name?: string; description?: string }
) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name !== undefined) updates.name = params.name.trim();
  if (params.description !== undefined)
    updates.description = params.description.trim() || null;

  const [updated] = await db
    .update(campaigns)
    .set(updates)
    .where(eq(campaigns.id, campaignId))
    .returning();
  return updated;
}
