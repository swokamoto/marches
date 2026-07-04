import { db } from "../db/index.js";
import { artifacts } from "../db/schema.js";
import { eq, and, isNull, ilike, count } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Artifact = InferSelectModel<typeof artifacts>;
export type ArtifactStatus = Artifact["status"];

export const ARTIFACTS_PER_PAGE = 30;

export async function getArtifacts(campaignId: string) {
  return db.query.artifacts.findMany({
    where: and(eq(artifacts.campaignId, campaignId), isNull(artifacts.archivedAt)),
    orderBy: (a, { asc }) => [asc(a.name)],
  });
}

export async function getArtifactsPaginated(campaignId: string, page = 1, isGm = true) {
  const offset = (page - 1) * ARTIFACTS_PER_PAGE;
  const baseWhere = and(eq(artifacts.campaignId, campaignId), isNull(artifacts.archivedAt));
  const whereClause = isGm ? baseWhere : and(baseWhere, eq(artifacts.revealed, true));
  const [rows, [{ total }]] = await Promise.all([
    db.query.artifacts.findMany({
      where: whereClause,
      with: {
        location: { columns: { id: true, name: true } },
        npc: { columns: { id: true, name: true } },
      },
      orderBy: (a, { asc }) => [asc(a.name)],
      limit: ARTIFACTS_PER_PAGE,
      offset,
    }),
    db.select({ total: count() }).from(artifacts)
      .where(whereClause),
  ]);
  return { artifacts: rows, total: Number(total), page, totalPages: Math.ceil(Number(total) / ARTIFACTS_PER_PAGE) };
}

export async function getArtifactById(id: string) {
  return db.query.artifacts.findFirst({
    where: eq(artifacts.id, id),
    with: { npc: { columns: { id: true, name: true } } },
  });
}

export async function searchArtifacts(campaignId: string, query: string) {
  return db.query.artifacts.findMany({
    where: and(
      eq(artifacts.campaignId, campaignId),
      isNull(artifacts.archivedAt),
      ilike(artifacts.name, `%${query}%`)
    ),
    columns: { id: true, name: true, status: true },
    limit: 10,
  });
}

export async function createArtifact(
  campaignId: string,
  name: string,
  createdBy: string,
  description?: string,
  revealed = false
) {
  const [artifact] = await db
    .insert(artifacts)
    .values({ campaignId, name: name.trim(), description: description?.trim() || null, createdBy, revealed })
    .returning();
  return artifact;
}

export async function updateArtifactRevealed(artifactId: string, revealed: boolean) {
  const [updated] = await db
    .update(artifacts)
    .set({ revealed, updatedAt: new Date() })
    .where(eq(artifacts.id, artifactId))
    .returning();
  return updated;
}

export async function updateArtifact(
  artifactId: string,
  params: { description?: string }
) {
  const [updated] = await db
    .update(artifacts)
    .set({ description: params.description?.trim() || null, updatedAt: new Date() })
    .where(eq(artifacts.id, artifactId))
    .returning();
  return updated;
}

export async function updateArtifactStatus(
  artifactId: string,
  status: ArtifactStatus
) {
  const [updated] = await db
    .update(artifacts)
    .set({ status, updatedAt: new Date() })
    .where(eq(artifacts.id, artifactId))
    .returning();
  return updated;
}

export async function updateArtifactLocation(
  artifactId: string,
  locationId: string | null
) {
  const [updated] = await db
    .update(artifacts)
    .set({ locationId, updatedAt: new Date() })
    .where(eq(artifacts.id, artifactId))
    .returning();
  return updated;
}

export async function updateArtifactNpc(
  artifactId: string,
  npcId: string | null
) {
  const [updated] = await db
    .update(artifacts)
    .set({ npcId, updatedAt: new Date() })
    .where(eq(artifacts.id, artifactId))
    .returning();
  return updated;
}

export async function getArtifactsWithLocation(campaignId: string) {
  return db.query.artifacts.findMany({
    where: and(eq(artifacts.campaignId, campaignId), isNull(artifacts.archivedAt)),
    orderBy: (a, { asc }) => [asc(a.name)],
    with: { location: { columns: { id: true, name: true } } },
  });
}

export async function archiveArtifact(artifactId: string) {
  const [updated] = await db
    .update(artifacts)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(artifacts.id, artifactId))
    .returning();
  return updated;
}
