import { describe, it, expect } from "vitest";
import { calcCampaignDay } from "./campaigns.js";

describe("calcCampaignDay", () => {
  const DAY = 86_400_000;

  it("returns 1 on the day the campaign starts", () => {
    const created = new Date("2024-01-01T00:00:00Z");
    expect(calcCampaignDay(created, new Date("2024-01-01T12:00:00Z"))).toBe(1);
  });

  it("returns 2 on the second day", () => {
    const created = new Date("2024-01-01T00:00:00Z");
    const at = new Date(created.getTime() + DAY);
    expect(calcCampaignDay(created, at)).toBe(2);
  });

  it("returns 367 after a full leap year (2024 has 366 days)", () => {
    const created = new Date("2024-01-01T00:00:00Z");
    const at = new Date("2025-01-01T00:00:00Z");
    // 366 days elapsed → floor(366) + 1 = 367
    expect(calcCampaignDay(created, at)).toBe(367);
  });

  it("returns 1 when called with no second argument on the start day", () => {
    // created = now → day 1
    const now = new Date();
    expect(calcCampaignDay(now)).toBe(1);
  });

  it("handles fractional days correctly (floors, not rounds)", () => {
    const created = new Date("2024-01-01T00:00:00Z");
    // 1.9 days later → still day 2
    const at = new Date(created.getTime() + DAY * 1.9);
    expect(calcCampaignDay(created, at)).toBe(2);
  });
});
