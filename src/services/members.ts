import { db } from "../db/index.js";
import { campaignMembers, campaignSettings, campaigns } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { randomBytes } from "crypto";

export type CampaignMember = InferSelectModel<typeof campaignMembers>;
export type CampaignMemberRole = CampaignMember["role"];

const VALID_ROLES: CampaignMemberRole[] = ["gm", "player", "observer"];

// ─── Invite code ──────────────────────────────────────────────────────────────

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F7C2B1"
}

export async function getOrCreateInviteCode(campaignId: string): Promise<string> {
  const existing = await db.query.campaignSettings.findFirst({
    where: and(
      eq(campaignSettings.campaignId, campaignId),
      eq(campaignSettings.key, "invite_code")
    ),
  });

  if (existing?.value) return existing.value;

  const code = generateCode();
  await db
    .insert(campaignSettings)
    .values({ campaignId, key: "invite_code", value: code })
    .onConflictDoUpdate({
      target: [campaignSettings.campaignId, campaignSettings.key],
      set: { value: code },
    });
  return code;
}

export async function rotateInviteCode(campaignId: string): Promise<string> {
  const code = generateCode();
  await db
    .insert(campaignSettings)
    .values({ campaignId, key: "invite_code", value: code })
    .onConflictDoUpdate({
      target: [campaignSettings.campaignId, campaignSettings.key],
      set: { value: code },
    });
  return code;
}

export async function getCampaignByInviteCode(code: string) {
  const setting = await db.query.campaignSettings.findFirst({
    where: and(
      eq(campaignSettings.key, "invite_code"),
      eq(campaignSettings.value, code.toUpperCase())
    ),
  });
  if (!setting) return null;
  return db.query.campaigns.findFirst({
    where: eq(campaigns.id, setting.campaignId),
  });
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(campaignId: string) {
  return db.query.campaignMembers.findMany({
    where: eq(campaignMembers.campaignId, campaignId),
    with: { user: { columns: { id: true, displayName: true, email: true } } },
    orderBy: (m, { asc }) => [asc(m.role), asc(m.joinedAt)],
  });
}

export async function addMember(
  campaignId: string,
  userId: string,
  role: CampaignMemberRole = "player"
): Promise<CampaignMember | undefined> {
  const [member] = await db
    .insert(campaignMembers)
    .values({ campaignId, userId, role })
    .onConflictDoNothing()
    .returning();
  return member;
}

export async function updateMemberRole(
  campaignId: string,
  userId: string,
  role: CampaignMemberRole
): Promise<CampaignMember> {
  const [member] = await db
    .update(campaignMembers)
    .set({ role })
    .where(
      and(
        eq(campaignMembers.campaignId, campaignId),
        eq(campaignMembers.userId, userId)
      )
    )
    .returning();
  return member;
}

export async function removeMember(campaignId: string, userId: string): Promise<void> {
  await db
    .delete(campaignMembers)
    .where(
      and(
        eq(campaignMembers.campaignId, campaignId),
        eq(campaignMembers.userId, userId)
      )
    );
}

export { VALID_ROLES };
