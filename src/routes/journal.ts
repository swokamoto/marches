import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import { getJournalEntries, createJournalEntry, pinJournalEntry, unpinJournalEntry } from "../services/journal.js";
import type { JournalEntityType, JournalVisibility } from "../services/journal.js";
import { calcCampaignDay } from "../services/campaigns.js";

const router = Router({ mergeParams: true });

const VALID_ENTITY_TYPES: JournalEntityType[] = [
  "campaign", "location", "npc", "artifact", "character", "expedition", "session",
];

function resolveDefaultVisibility(role: string): JournalVisibility {
  return role === "gm" || role === "admin" ? "public" : "private";
}

// ─── GET entries partial (loaded by HTMX on entity detail pages) ──────────────

router.get("/:entityType/:entityId", async (req, res) => {
  const entityType = req.params.entityType as JournalEntityType;

  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).send("Invalid entity type.");
  }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));

  const { entries, total, totalPages } = await getJournalEntries(
    res.locals.campaign.id,
    entityType,
    req.params.entityId,
    req.session.userId!,
    res.locals.member.role,
    page
  );

  res.render("partials/journal-entries.njk", {
    entries,
    entityType,
    entityId: req.params.entityId,
    page,
    totalPages,
    total,
    currentCampaignDay: calcCampaignDay(res.locals.campaign.createdAt),
  });
});

// ─── POST create entry ────────────────────────────────────────────────────────

router.post("/:entityType/:entityId", async (req, res) => {
  const entityType = req.params.entityType as JournalEntityType;

  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).send("Invalid entity type.");
  }

  const { body, visibility, campaign_day } = req.body as {
    body: string;
    visibility?: string;
    campaign_day?: string;
  };

  if (!body?.trim()) {
    return res.status(400).send("Entry body is required.");
  }

  const role = res.locals.member.role as string;
  const defaultVisibility = resolveDefaultVisibility(role);

  // Validate and resolve visibility
  const validVisibilities: JournalVisibility[] = ["public", "gm_only", "private"];
  const resolvedVisibility: JournalVisibility =
    visibility && validVisibilities.includes(visibility as JournalVisibility)
      ? (visibility as JournalVisibility)
      : defaultVisibility;

  // Players cannot create gm_only entries
  if (resolvedVisibility === "gm_only" && role === "player") {
    return res.status(403).send("Players cannot create GM-only entries.");
  }

  await createJournalEntry({
    campaignId: res.locals.campaign.id,
    authorId: req.session.userId!,
    authorRole: role as "admin" | "gm" | "player" | "observer",
    entityType,
    entityId: req.params.entityId,
    body,
    visibility: resolvedVisibility,
    campaignDay: campaign_day ? parseInt(campaign_day) : calcCampaignDay(res.locals.campaign.createdAt),
  });

  // Return updated entries partial for HTMX swap
  const { entries, total, totalPages } = await getJournalEntries(
    res.locals.campaign.id,
    entityType,
    req.params.entityId,
    req.session.userId!,
    role
  );

  res.render("partials/journal-entries.njk", {
    entries,
    entityType,
    entityId: req.params.entityId,
    page: 1,
    total,
    totalPages,
    currentCampaignDay: calcCampaignDay(res.locals.campaign.createdAt),
  });
});

// ─── Pin / unpin (GM/admin only) ─────────────────────────────────────────────

router.post(
  "/:entityType/:entityId/:entryId/pin",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const entityType = req.params.entityType as JournalEntityType;
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).send("Invalid entity type.");
    }
    await pinJournalEntry(String(req.params.entryId));
    const { entries, total, totalPages } = await getJournalEntries(
      res.locals.campaign.id, entityType, String(req.params.entityId),
      req.session.userId!, res.locals.member.role
    );
    res.render("partials/journal-entries.njk", {
      entries, entityType, entityId: req.params.entityId,
      page: 1, total, totalPages,
      currentCampaignDay: calcCampaignDay(res.locals.campaign.createdAt),
    });
  }
);

router.post(
  "/:entityType/:entityId/:entryId/unpin",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const entityType = req.params.entityType as JournalEntityType;
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).send("Invalid entity type.");
    }
    await unpinJournalEntry(String(req.params.entryId));
    const { entries, total, totalPages } = await getJournalEntries(
      res.locals.campaign.id, entityType, String(req.params.entityId),
      req.session.userId!, res.locals.member.role
    );
    res.render("partials/journal-entries.njk", {
      entries, entityType, entityId: req.params.entityId,
      page: 1, total, totalPages,
      currentCampaignDay: calcCampaignDay(res.locals.campaign.createdAt),
    });
  }
);

export default router;
