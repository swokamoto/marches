import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations, resetDb } from "../db/test-helpers.js";
import { registerUser } from "./auth.js";
import { createCampaign } from "./campaigns.js";
import {
  createLocation,
  getLocationBySlug,
  addLocationConnection,
  updateLocationParent,
} from "./locations.js";

describe("locations service (integration)", () => {
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

  // ─── createLocation / slug ─────────────────────────────────────────────────

  it("creates a location with the correct slug and name", async () => {
    const loc = await createLocation(campaignId, "The Dark Forest", userId);
    expect(loc.name).toBe("The Dark Forest");
    expect(loc.slug).toBe("the-dark-forest");
  });

  it("deduplicates slugs within the same campaign", async () => {
    const l1 = await createLocation(campaignId, "The Keep", userId);
    const l2 = await createLocation(campaignId, "The Keep", userId);
    const l3 = await createLocation(campaignId, "The Keep", userId);
    expect(l1.slug).toBe("the-keep");
    expect(l2.slug).toBe("the-keep-2");
    expect(l3.slug).toBe("the-keep-3");
  });

  it("allows the same slug in different campaigns", async () => {
    const user2 = await registerUser("gm2@example.com", "GM2", "password123");
    if ("error" in user2) throw new Error("Failed to create user2");
    const campaign2 = await createCampaign("Other Campaign", undefined, user2.id);

    const l1 = await createLocation(campaignId, "The Ruins", userId);
    const l2 = await createLocation(campaign2.id, "The Ruins", user2.id);
    expect(l1.slug).toBe("the-ruins");
    expect(l2.slug).toBe("the-ruins"); // no conflict across campaigns
  });

  it("falls back to 'untitled' slug for unsluggable names", async () => {
    const l1 = await createLocation(campaignId, "!!!", userId);
    expect(l1.slug).toBe("untitled");
    const l2 = await createLocation(campaignId, "???", userId);
    expect(l2.slug).toBe("untitled-2");
  });

  // ─── Parent / children ─────────────────────────────────────────────────────

  it("assigns a parent location at create time", async () => {
    const parent = await createLocation(campaignId, "The Kingdom", userId);
    await createLocation(campaignId, "The Capital", userId, parent.id);

    const found = await getLocationBySlug(campaignId, "the-capital");
    expect(found?.parent?.id).toBe(parent.id);
    expect(found?.parent?.name).toBe("The Kingdom");
  });

  it("updateLocationParent sets and clears a parent", async () => {
    const parent = await createLocation(campaignId, "The Region", userId);
    const child = await createLocation(campaignId, "The Village", userId);

    await updateLocationParent(child.id, parent.id);
    const withParent = await getLocationBySlug(campaignId, "the-village");
    expect(withParent?.parent?.id).toBe(parent.id);

    await updateLocationParent(child.id, null);
    const withoutParent = await getLocationBySlug(campaignId, "the-village");
    expect(withoutParent?.parent).toBeNull();
  });

  it("parent includes its children in the relation", async () => {
    const parent = await createLocation(campaignId, "The Continent", userId);
    await createLocation(campaignId, "North Province", userId, parent.id);
    await createLocation(campaignId, "South Province", userId, parent.id);

    const found = await getLocationBySlug(campaignId, "the-continent");
    expect(found?.children).toHaveLength(2);
  });

  // ─── Connections ──────────────────────────────────────────────────────────

  it("adds a connection between two locations", async () => {
    const a = await createLocation(campaignId, "Town A", userId);
    const b = await createLocation(campaignId, "Town B", userId);
    await addLocationConnection(a.id, b.id, "2-day journey");

    const updated = await getLocationBySlug(campaignId, "town-a");
    expect(updated?.connectionsFrom).toHaveLength(1);
    expect(updated?.connectionsFrom[0].toLocation.name).toBe("Town B");
    expect(updated?.connectionsFrom[0].description).toBe("2-day journey");
  });

  it("deduplicates connections — adding the same pair twice does not throw or double-add", async () => {
    const a = await createLocation(campaignId, "Ruins A", userId);
    const b = await createLocation(campaignId, "Ruins B", userId);
    await addLocationConnection(a.id, b.id);
    await addLocationConnection(a.id, b.id); // duplicate — onConflictDoNothing

    const updated = await getLocationBySlug(campaignId, "ruins-a");
    expect(updated?.connectionsFrom).toHaveLength(1);
  });
});
