import { db } from "../db/index.js";
import { artifacts } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type Artifact = InferSelectModel<typeof artifacts>;
export type ArtifactStatus = Artifact["status"];

export async function getArtifacts(campaignId: string) {
  return db.query.artifacts.findMany({
    where: and(eq(artifacts.campaignId, campaignId), isNull(artifacts.archivedAt)),
    orderBy: (a, { asc }) => [asc(a.name)],
  });
}

export async function getArtifactById(id: string) {
  return db.query.artifacts.findFirst({ where: eq(artifacts.id, id) });
}

export async function searchArtifacts(campaignId: string, query: string) {
  const all = await db.query.artifacts.findMany({
    where: eq(artifacts.campaignId, campaignId),
    columns: { id: true, name: true, status: true },
  });
  const q = query.toLowerCase();
  return all.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 10);
}

export async function createArtifact(
  campaignId: string,
  name: string,
  createdBy: string
) {
  const [artifact] = await db
    .insert(artifacts)
    .values({ campaignId, name: name.trim(), createdBy })
    .returning();
  return artifact;
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
