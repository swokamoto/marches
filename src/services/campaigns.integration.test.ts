import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runMigrations, resetDb } from "../db/test-helpers.js";
import { registerUser } from "./auth.js";
import { createCampaign, getCampaignBySlug, getCampaignMember } from "./campaigns.js";

describe("campaigns service (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await resetDb();
    const result = await registerUser("gm@example.com", "GM", "password123");
    if ("error" in result) throw new Error("Failed to create test user");
    userId = result.id;
  });

  it("creates a campaign retrievable by slug", async () => {
    const campaign = await createCampaign("The Lost Mines", undefined, userId);
    expect(campaign.slug).toBe("the-lost-mines");

    const found = await getCampaignBySlug("the-lost-mines");
    expect(found?.id).toBe(campaign.id);
    expect(found?.name).toBe("The Lost Mines");
  });

  it("creator is automatically an admin member", async () => {
    const campaign = await createCampaign("Dragon's Keep", undefined, userId);
    const member = await getCampaignMember(campaign.id, userId);
    expect(member?.role).toBe("admin");
  });

  it("deduplicates slugs when names collide", async () => {
    const c1 = await createCampaign("The Dragon Heist", undefined, userId);
    const c2 = await createCampaign("The Dragon Heist", undefined, userId);
    expect(c1.slug).toBe("the-dragon-heist");
    expect(c2.slug).toBe("the-dragon-heist-2");

    const c3 = await createCampaign("The Dragon Heist", undefined, userId);
    expect(c3.slug).toBe("the-dragon-heist-3");
  });

  it("falls back to 'untitled' slug when the name has no slugifiable characters", async () => {
    const c1 = await createCampaign("!!!", undefined, userId);
    expect(c1.slug).toBe("untitled");

    const c2 = await createCampaign("???", undefined, userId);
    expect(c2.slug).toBe("untitled-2");
  });

  it("stores and trims the description", async () => {
    const campaign = await createCampaign("Deep Roads", "  A dark place.  ", userId);
    expect(campaign.description).toBe("A dark place.");
  });
});
