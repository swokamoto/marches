import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations, resetDb } from "../db/test-helpers.js";
import { registerUser } from "./auth.js";
import { createCampaign } from "./campaigns.js";
import {
  createFaction,
  getFactions,
  getFactionById,
  updateFaction,
  updateFactionStatus,
  archiveFaction,
} from "./factions.js";
import { createNpc, getNpcById } from "./npcs.js";

describe("factions service (integration)", () => {
  let userId: string;
  let campaignId: string;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDb();
    const user = await registerUser("gm@example.com", "GM", "password123");
    if ("error" in user) throw new Error("Failed to create test user");
    userId = user.id;
    const campaign = await createCampaign("Test Campaign", undefined, userId);
    campaignId = campaign.id;
  });

  // ─── createFaction ─────────────────────────────────────────────────────────

  it("creates a faction with correct fields", async () => {
    const faction = await createFaction(campaignId, "The Iron Circle", userId, "Mercenary guild");
    expect(faction.name).toBe("The Iron Circle");
    expect(faction.description).toBe("Mercenary guild");
    expect(faction.status).toBe("active");
    expect(faction.campaignId).toBe(campaignId);
  });

  it("trims whitespace from name and description", async () => {
    const faction = await createFaction(campaignId, "  The Guild  ", userId, "  Desc  ");
    expect(faction.name).toBe("The Guild");
    expect(faction.description).toBe("Desc");
  });

  // ─── getFactions ───────────────────────────────────────────────────────────

  it("returns only non-archived factions for the campaign", async () => {
    await createFaction(campaignId, "Faction A", userId);
    const f2 = await createFaction(campaignId, "Faction B", userId);
    await archiveFaction(f2.id);

    const list = await getFactions(campaignId);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Faction A");
  });

  it("returns factions ordered by name", async () => {
    await createFaction(campaignId, "Zephyr", userId);
    await createFaction(campaignId, "Acolytes", userId);
    await createFaction(campaignId, "Merchants", userId);

    const list = await getFactions(campaignId);
    expect(list.map((f) => f.name)).toEqual(["Acolytes", "Merchants", "Zephyr"]);
  });

  it("does not return factions from other campaigns", async () => {
    const user2 = await registerUser("gm2@example.com", "GM2", "password123");
    if ("error" in user2) throw new Error("Failed to create user2");
    const campaign2 = await createCampaign("Other Campaign", undefined, user2.id);

    await createFaction(campaignId, "Our Faction", userId);
    await createFaction(campaign2.id, "Their Faction", user2.id);

    const list = await getFactions(campaignId);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Our Faction");
  });

  // ─── getFactionById ────────────────────────────────────────────────────────

  it("returns faction with its NPC members", async () => {
    const faction = await createFaction(campaignId, "The Circle", userId);
    await createNpc(campaignId, "Guard", userId, undefined, faction.id);
    await createNpc(campaignId, "Captain", userId, undefined, faction.id);

    const found = await getFactionById(faction.id);
    expect(found?.npcs).toHaveLength(2);
    expect(found?.npcs.map((n) => n.name).sort()).toEqual(["Captain", "Guard"]);
  });

  it("excludes archived NPCs from faction members", async () => {
    const faction = await createFaction(campaignId, "The Circle", userId);
    const npc1 = await createNpc(campaignId, "Active Guard", userId, undefined, faction.id);
    const npc2 = await createNpc(campaignId, "Archived Guard", userId, undefined, faction.id);

    // Archive npc2 directly via the npcs service
    const { archiveNpc } = await import("./npcs.js");
    await archiveNpc(npc2.id);

    const found = await getFactionById(faction.id);
    expect(found?.npcs).toHaveLength(1);
    expect(found?.npcs[0].id).toBe(npc1.id);
  });

  // ─── updateFaction ─────────────────────────────────────────────────────────

  it("updates description", async () => {
    const faction = await createFaction(campaignId, "The Order", userId, "Old desc");
    const updated = await updateFaction(faction.id, { description: "New desc" });
    expect(updated.description).toBe("New desc");
  });

  it("clears description when empty string is passed", async () => {
    const faction = await createFaction(campaignId, "The Order", userId, "Some desc");
    const updated = await updateFaction(faction.id, { description: "" });
    expect(updated.description).toBeNull();
  });

  // ─── updateFactionStatus ───────────────────────────────────────────────────

  it("updates faction status", async () => {
    const faction = await createFaction(campaignId, "The Order", userId);
    const updated = await updateFactionStatus(faction.id, "disbanded");
    expect(updated.status).toBe("disbanded");
  });

  // ─── archiveFaction ────────────────────────────────────────────────────────

  it("sets archivedAt on the faction", async () => {
    const faction = await createFaction(campaignId, "The Order", userId);
    expect(faction.archivedAt).toBeNull();

    await archiveFaction(faction.id);
    const found = await getFactionById(faction.id);
    expect(found?.archivedAt).toBeTruthy();
  });

  // ─── NPC faction assignment ────────────────────────────────────────────────

  it("createNpc with factionId stores the FK", async () => {
    const faction = await createFaction(campaignId, "The Guild", userId);
    const npc = await createNpc(campaignId, "Guildmaster", userId, undefined, faction.id);

    const found = await getNpcById(npc.id);
    expect(found?.factionId).toBe(faction.id);
    expect(found?.faction?.name).toBe("The Guild");
  });

  it("createNpc without factionId has null factionId", async () => {
    const npc = await createNpc(campaignId, "Wanderer", userId);
    const found = await getNpcById(npc.id);
    expect(found?.factionId).toBeNull();
  });
});
