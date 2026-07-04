import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  getFactions,
  getFactionById,
  createFaction,
  updateFaction,
  updateFactionStatus,
  archiveFaction,
} from "../services/factions.js";
import { logActivity } from "../services/activity.js";

const router = Router({ mergeParams: true });

router.get("/", async (_req, res) => {
  const factionList = await getFactions(res.locals.campaign.id);
  res.render("pages/factions/index.njk", {
    title: `Factions — ${res.locals.campaign.name}`,
    factionList,
  });
});

router.get("/new", requireCampaignRole("gm", "admin"), (_req, res) => {
  res.render("pages/factions/new.njk", { title: "New Faction" });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name?.trim()) {
    req.session.flash = { error: "Faction name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/factions/new`);
  }
  const faction = await createFaction(
    res.locals.campaign.id,
    name,
    req.session.userId!,
    description
  );
  void logActivity({
    campaignId: res.locals.campaign.id,
    actorId: req.session.userId!,
    actionType: "faction.created",
    entityType: "faction",
    entityId: faction.id,
    metadata: { name: faction.name },
    gmOnly: true,
  });
  req.session.flash = { success: `Faction "${faction.name}" created.` };
  res.redirect(`/campaigns/${res.locals.campaign.slug}/factions/${faction.id}`);
});

router.get("/:factionId", async (req, res) => {
  const faction = await getFactionById(req.params.factionId);
  if (!faction || faction.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { status: "404", message: "Faction not found." });
  }
  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  res.render("pages/factions/show.njk", {
    title: `${faction.name} — ${res.locals.campaign.name}`,
    faction,
    isGm,
  });
});

router.post(
  "/:factionId/description",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const factionId = Array.isArray(req.params.factionId) ? req.params.factionId[0] : req.params.factionId;
    const faction = await getFactionById(factionId);
    if (!faction || faction.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Faction not found." });
    }
    const { description } = req.body as { description?: string };
    await updateFaction(faction.id, { description });
    req.session.flash = { success: "Description updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/factions/${faction.id}`);
  }
);

router.post(
  "/:factionId/status",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const factionId = Array.isArray(req.params.factionId) ? req.params.factionId[0] : req.params.factionId;
    const faction = await getFactionById(factionId);
    if (!faction || faction.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Faction not found." });
    }
    const { status } = req.body as { status: string };
    const validStatuses = ["active", "disbanded", "unknown"];
    if (!validStatuses.includes(status)) {
      req.session.flash = { error: "Invalid status." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/factions/${faction.id}`);
    }
    await updateFactionStatus(faction.id, status as Parameters<typeof updateFactionStatus>[1]);
    res.redirect(`/campaigns/${res.locals.campaign.slug}/factions/${faction.id}`);
  }
);

router.post(
  "/:factionId/archive",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const factionId = Array.isArray(req.params.factionId) ? req.params.factionId[0] : req.params.factionId;
    const faction = await getFactionById(factionId);
    if (!faction || faction.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Faction not found." });
    }
    await archiveFaction(faction.id);
    void logActivity({
      campaignId: res.locals.campaign.id,
      actorId: req.session.userId!,
      actionType: "faction.archived",
      entityType: "faction",
      entityId: faction.id,
      metadata: { name: faction.name },
      gmOnly: true,
    });
    req.session.flash = { success: `"${faction.name}" has been archived.` };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/factions`);
  }
);

export default router;
