import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import { getNpcsPaginated, getNpcById, createNpc, updateNpc, updateNpcStatus, searchNpcs, updateNpcLocation, getNpcsWithLocation, archiveNpc, updateNpcFaction, updateNpcRevealed } from "../services/npcs.js";
import { getLocations } from "../services/locations.js";
import { getFactions } from "../services/factions.js";
import { logActivity } from "../services/activity.js";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const { npcs: npcList, total, totalPages } = await getNpcsPaginated(res.locals.campaign.id, page, isGm);
  res.render("pages/npcs/index.njk", {
    title: `NPCs — ${res.locals.campaign.name}`,
    npcList,
    page,
    total,
    totalPages,
    isGm,
  });
});

router.get("/new", requireCampaignRole("gm", "admin"), async (_req, res) => {
  const factionList = await getFactions(res.locals.campaign.id);
  res.render("pages/npcs/new.njk", { title: "New NPC", factionList });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { name, description, faction_id, revealed } = req.body as { name: string; description?: string; faction_id?: string; revealed?: string };
  if (!name?.trim()) {
    req.session.flash = { error: "NPC name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/new`);
  }
  const npc = await createNpc(res.locals.campaign.id, name, req.session.userId!, description, faction_id || null, revealed === "on");
  void logActivity({
    campaignId: res.locals.campaign.id,
    actorId: req.session.userId!,
    actionType: "npc.created",
    entityType: "npc",
    entityId: npc.id,
    metadata: { name: npc.name },
    gmOnly: true,
  });
  req.session.flash = { success: `NPC "${npc.name}" created.` };
  res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);
  const results = await searchNpcs(res.locals.campaign.id, q);
  res.json(results);
});

router.get("/:npcId", async (req, res) => {
  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const npc = await getNpcById(req.params.npcId, isGm);
  if (!npc || npc.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
  }
  if (!isGm && !npc.revealed) {
    return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
  }
  const [campaignLocations, factionList] = await Promise.all([
    getLocations(res.locals.campaign.id),
    getFactions(res.locals.campaign.id),
  ]);
  res.render("pages/npcs/show.njk", {
    title: `${npc.name} — ${res.locals.campaign.name}`,
    npc,
    campaignLocations,
    factionList,
    isGm,
  });
});

router.post(
  "/:npcId/description",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const npcId = Array.isArray(req.params.npcId) ? req.params.npcId[0] : req.params.npcId;
    const npc = await getNpcById(npcId);
    if (!npc || npc.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
    }
    const { description } = req.body as { description?: string };
    await updateNpc(npc.id, { description });
    req.session.flash = { success: "Description updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
  }
);

router.post(
  "/:npcId/status",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const npcId = Array.isArray(req.params.npcId) ? req.params.npcId[0] : req.params.npcId;
    const npc = await getNpcById(npcId);
    if (!npc || npc.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
    }

    const { status } = req.body as { status: string };
    const validStatuses = ["alive", "dead", "missing", "unknown"];
    if (!validStatuses.includes(status)) {
      req.session.flash = { error: "Invalid status." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
    }

    const updated = await updateNpcStatus(npc.id, status as Parameters<typeof updateNpcStatus>[1]);

    if (req.headers["hx-request"]) {
      return res.render("partials/npc-status-badge.njk", { npc: updated });
    }
    res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
  }
);

router.post(
  "/:npcId/location",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const npcId = Array.isArray(req.params.npcId) ? req.params.npcId[0] : req.params.npcId;
    const npc = await getNpcById(npcId);
    if (!npc || npc.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
    }
    const { location_id } = req.body as { location_id: string };
    await updateNpcLocation(npc.id, location_id || null);
    req.session.flash = { success: "Location updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
  }
);

router.post(
  "/:npcId/faction",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const npcId = Array.isArray(req.params.npcId) ? req.params.npcId[0] : req.params.npcId;
    const npc = await getNpcById(npcId);
    if (!npc || npc.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
    }
    const { faction_id } = req.body as { faction_id: string };
    await updateNpcFaction(npc.id, faction_id || null);
    req.session.flash = { success: "Faction updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
  }
);

router.post(
  "/:npcId/archive",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const npcId = Array.isArray(req.params.npcId) ? req.params.npcId[0] : req.params.npcId;
    const npc = await getNpcById(npcId);
    if (!npc || npc.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
    }
    await archiveNpc(npc.id);
    void logActivity({
      campaignId: res.locals.campaign.id,
      actorId: req.session.userId!,
      actionType: "npc.archived",
      entityType: "npc",
      entityId: npc.id,
      metadata: { name: npc.name },
      gmOnly: true,
    });
    req.session.flash = { success: `"${npc.name}" has been archived.` };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs`);
  }
);

router.post(
  "/:npcId/reveal",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const npcId = Array.isArray(req.params.npcId) ? req.params.npcId[0] : req.params.npcId;
    const npc = await getNpcById(npcId);
    if (!npc || npc.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "NPC not found." });
    }
    const revealed = req.body.revealed === "true";
    await updateNpcRevealed(npc.id, revealed);
    res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
  }
);

export default router;
