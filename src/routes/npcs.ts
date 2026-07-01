import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import { getNpcs, getNpcById, createNpc, updateNpcStatus, searchNpcs, updateNpcLocation, getNpcsWithLocation } from "../services/npcs.js";
import { getLocations } from "../services/locations.js";

const router = Router({ mergeParams: true });

router.get("/", async (_req, res) => {
  const npcList = await getNpcsWithLocation(res.locals.campaign.id);
  res.render("pages/npcs/index.njk", {
    title: `NPCs — ${res.locals.campaign.name}`,
    npcList,
  });
});

router.get("/new", requireCampaignRole("gm", "admin"), (_req, res) => {
  res.render("pages/npcs/new.njk", { title: "New NPC" });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) {
    req.session.flash = { error: "NPC name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/new`);
  }
  const npc = await createNpc(res.locals.campaign.id, name, req.session.userId!);
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
  const npc = await getNpcById(req.params.npcId);
  if (!npc || npc.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { message: "NPC not found." });
  }
  const campaignLocations = await getLocations(res.locals.campaign.id);
  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  res.render("pages/npcs/show.njk", {
    title: `${npc.name} — ${res.locals.campaign.name}`,
    npc,
    campaignLocations,
    isGm,
  });
});

router.post(
  "/:npcId/status",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const npcId = Array.isArray(req.params.npcId) ? req.params.npcId[0] : req.params.npcId;
    const npc = await getNpcById(npcId);
    if (!npc || npc.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "NPC not found." });
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
      return res.status(404).render("pages/error.njk", { message: "NPC not found." });
    }
    const { location_id } = req.body as { location_id: string };
    await updateNpcLocation(npc.id, location_id || null);
    req.session.flash = { success: "Location updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/npcs/${npc.id}`);
  }
);

export default router;
