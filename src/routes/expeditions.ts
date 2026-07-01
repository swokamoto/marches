import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  getExpeditions,
  getExpeditionById,
  createExpedition,
  updateExpeditionStatus,
  addExpeditionLocation,
  removeExpeditionLocation,
  addExpeditionNpc,
  removeExpeditionNpc,
  addExpeditionArtifact,
  removeExpeditionArtifact,
  addExpeditionParticipant,
  removeExpeditionParticipant,
  getPlayerCharactersForCampaign,
} from "../services/expeditions.js";
import { getLocations } from "../services/locations.js";
import { getNpcs } from "../services/npcs.js";
import { getArtifacts } from "../services/artifacts.js";
import { detectConflicts } from "../services/conflicts.js";
import { createSession } from "../services/sessions.js";
import { logActivity } from "../services/activity.js";

const router = Router({ mergeParams: true });

const STATUS_PIPELINE: Record<string, string> = {
  recruiting: "scheduled",
  scheduled: "active",
  active: "completed",
};

// ─── List ─────────────────────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  const expeditionList = await getExpeditions(res.locals.campaign.id);
  res.render("pages/expeditions/index.njk", {
    title: `Expeditions — ${res.locals.campaign.name}`,
    expeditionList,
  });
});

// ─── New ──────────────────────────────────────────────────────────────────────

router.get("/new", requireCampaignRole("gm", "admin"), (_req, res) => {
  res.render("pages/expeditions/new.njk", { title: "New Expedition" });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { title, premise, scheduled_date } = req.body as {
    title: string;
    premise?: string;
    scheduled_date?: string;
  };

  if (!title?.trim()) {
    req.session.flash = { error: "Expedition title is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/expeditions/new`);
  }

  const expedition = await createExpedition({
    campaignId: res.locals.campaign.id,
    gmId: req.session.userId!,
    title,
    premise,
    scheduledDate: scheduled_date ? new Date(scheduled_date) : undefined,
  });

  req.session.flash = { success: `Expedition "${expedition.title}" created.` };
  res.redirect(`/campaigns/${res.locals.campaign.slug}/expeditions/${expedition.id}`);

  // fire-and-forget — don't block the redirect
  void logActivity({
    campaignId: res.locals.campaign.id,
    actorId: req.session.userId!,
    actionType: "expedition.created",
    entityType: "expedition",
    entityId: expedition.id,
    metadata: { title: expedition.title },
  });
});

// ─── Detail ───────────────────────────────────────────────────────────────────

router.get("/:expeditionId", async (req, res) => {
  const expedition = await getExpeditionById(req.params.expeditionId as string);

  if (!expedition || expedition.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { message: "Expedition not found." });
  }

  const playerCharacters = await getPlayerCharactersForCampaign(
    res.locals.campaign.id,
    req.session.userId!
  );

  const [campaignLocations, campaignNpcs, campaignArtifacts, conflicts] = await Promise.all([
    getLocations(res.locals.campaign.id),
    getNpcs(res.locals.campaign.id),
    getArtifacts(res.locals.campaign.id),
    detectConflicts(expedition.id),
  ]);

  const nextStatus = STATUS_PIPELINE[expedition.status] ?? null;

  res.render("pages/expeditions/show.njk", {
    title: `${expedition.title} — ${res.locals.campaign.name}`,
    expedition,
    playerCharacters,
    campaignLocations,
    campaignNpcs,
    campaignArtifacts,
    conflicts,
    nextStatus,
  });
});

// ─── Status advance ───────────────────────────────────────────────────────────

router.post(
  "/:expeditionId/advance",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const expedition = await getExpeditionById(req.params.expeditionId as string);
    if (!expedition || expedition.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Expedition not found." });
    }

    const next = STATUS_PIPELINE[expedition.status];
    if (!next) {
      req.session.flash = { error: "Expedition cannot be advanced further." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/expeditions/${expedition.id}`);
    }

    const updated = await updateExpeditionStatus(expedition.id, next as Parameters<typeof updateExpeditionStatus>[1]);

    void logActivity({
      campaignId: res.locals.campaign.id,
      actorId: req.session.userId!,
      actionType: "expedition.status_changed",
      entityType: "expedition",
      entityId: expedition.id,
      metadata: { title: expedition.title, status: next },
    });

    if (req.headers["hx-request"]) {
      return res.render("partials/expedition-status-zone.njk", {
        expedition: updated,
        nextStatus: STATUS_PIPELINE[next] ?? null,
      });
    }

    res.redirect(`/campaigns/${res.locals.campaign.slug}/expeditions/${expedition.id}`);
  }
);

router.post(
  "/:expeditionId/cancel",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const expedition = await getExpeditionById(req.params.expeditionId as string);
    if (!expedition || expedition.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Expedition not found." });
    }

    await updateExpeditionStatus(expedition.id, "cancelled");
    res.redirect(`/campaigns/${res.locals.campaign.slug}/expeditions`);
  }
);

// ─── Entity linking ───────────────────────────────────────────────────────────

router.post("/:expeditionId/locations/add", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { locationId } = req.body as { locationId: string };
  await addExpeditionLocation(req.params.expeditionId as string, locationId);
  const [expedition, campaignLocations] = await Promise.all([
    getExpeditionById(req.params.expeditionId as string),
    getLocations(res.locals.campaign.id),
  ]);
  res.render("partials/expedition-locations.njk", { expedition, campaignLocations });
});

router.post("/:expeditionId/locations/remove", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { locationId } = req.body as { locationId: string };
  await removeExpeditionLocation(req.params.expeditionId as string, locationId);
  const [expedition, campaignLocations] = await Promise.all([
    getExpeditionById(req.params.expeditionId as string),
    getLocations(res.locals.campaign.id),
  ]);
  res.render("partials/expedition-locations.njk", { expedition, campaignLocations });
});

router.post("/:expeditionId/npcs/add", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { npcId } = req.body as { npcId: string };
  await addExpeditionNpc(req.params.expeditionId as string, npcId);
  const [expedition, campaignNpcs] = await Promise.all([
    getExpeditionById(req.params.expeditionId as string),
    getNpcs(res.locals.campaign.id),
  ]);
  res.render("partials/expedition-npcs.njk", { expedition, campaignNpcs });
});

router.post("/:expeditionId/npcs/remove", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { npcId } = req.body as { npcId: string };
  await removeExpeditionNpc(req.params.expeditionId as string, npcId);
  const [expedition, campaignNpcs] = await Promise.all([
    getExpeditionById(req.params.expeditionId as string),
    getNpcs(res.locals.campaign.id),
  ]);
  res.render("partials/expedition-npcs.njk", { expedition, campaignNpcs });
});

router.post("/:expeditionId/artifacts/add", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { artifactId } = req.body as { artifactId: string };
  await addExpeditionArtifact(req.params.expeditionId as string, artifactId);
  const [expedition, campaignArtifacts] = await Promise.all([
    getExpeditionById(req.params.expeditionId as string),
    getArtifacts(res.locals.campaign.id),
  ]);
  res.render("partials/expedition-artifacts.njk", { expedition, campaignArtifacts });
});

router.post("/:expeditionId/artifacts/remove", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { artifactId } = req.body as { artifactId: string };
  await removeExpeditionArtifact(req.params.expeditionId as string, artifactId);
  const [expedition, campaignArtifacts] = await Promise.all([
    getExpeditionById(req.params.expeditionId as string),
    getArtifacts(res.locals.campaign.id),
  ]);
  res.render("partials/expedition-artifacts.njk", { expedition, campaignArtifacts });
});

// ─── Participants ─────────────────────────────────────────────────────────────

router.post("/:expeditionId/join", async (req, res) => {
  const { characterId } = req.body as { characterId: string };

  // Verify the character belongs to the requesting user
  const characters = await getPlayerCharactersForCampaign(
    res.locals.campaign.id,
    req.session.userId!
  );
  const owns = characters.some((c) => c.id === characterId);

  if (!owns) {
    return res.status(403).render("pages/error.njk", { message: "Character not found." });
  }

  await addExpeditionParticipant(req.params.expeditionId as string, characterId);
  const expedition = await getExpeditionById(req.params.expeditionId as string);
  res.render("partials/expedition-participants.njk", {
    expedition,
    playerCharacters: characters,
  });
});

router.post("/:expeditionId/leave", async (req, res) => {
  const { characterId } = req.body as { characterId: string };

  const characters = await getPlayerCharactersForCampaign(
    res.locals.campaign.id,
    req.session.userId!
  );
  const owns = characters.some((c) => c.id === characterId);

  // GMs can also remove participants
  const isGm = ["gm", "admin"].includes(res.locals.member.role);

  if (!owns && !isGm) {
    return res.status(403).render("pages/error.njk", { message: "Permission denied." });
  }

  await removeExpeditionParticipant(req.params.expeditionId as string, characterId);
  const expedition = await getExpeditionById(req.params.expeditionId as string);
  res.render("partials/expedition-participants.njk", {
    expedition,
    playerCharacters: characters,
  });
});

  router.post(
  "/:expeditionId/sessions/create",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const expeditionId = req.params.expeditionId as string;
    const { campaign_day } = req.body as { campaign_day?: string };

    const expedition = await getExpeditionById(expeditionId);
    if (!expedition || expedition.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Expedition not found." });
    }

    const session = await createSession({
      expeditionId,
      gmId: req.session.userId!,
      campaignId: res.locals.campaign.id,
      campaignDay: campaign_day ? parseInt(campaign_day) : undefined,
      playedAt: new Date(),
    });

    void logActivity({
      campaignId: res.locals.campaign.id,
      actorId: req.session.userId!,
      actionType: "session.created",
      entityType: "session",
      entityId: session.id,
      metadata: { expeditionTitle: expedition.title },
    });

    req.session.flash = { success: "Session started." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

export default router;
