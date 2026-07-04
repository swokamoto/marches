import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import { getArtifactsPaginated, getArtifactById, createArtifact, updateArtifact, updateArtifactStatus, searchArtifacts, updateArtifactLocation, updateArtifactNpc, updateArtifactRevealed, archiveArtifact } from "../services/artifacts.js";
import { getLocations } from "../services/locations.js";
import { getNpcs, getNpcById } from "../services/npcs.js";
import { logActivity } from "../services/activity.js";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const { artifacts: artifactList, total, totalPages } = await getArtifactsPaginated(res.locals.campaign.id, page, isGm);
  res.render("pages/artifacts/index.njk", {
    title: `Artifacts — ${res.locals.campaign.name}`,
    artifactList,
    page,
    total,
    totalPages,
    isGm,
  });
});

router.get("/new", requireCampaignRole("gm", "admin"), (_req, res) => {
  res.render("pages/artifacts/new.njk", { title: "New Artifact" });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { name, description, revealed } = req.body as { name: string; description?: string; revealed?: string };
  if (!name?.trim()) {
    req.session.flash = { error: "Artifact name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/new`);
  }
  const artifact = await createArtifact(res.locals.campaign.id, name, req.session.userId!, description, revealed === "on");
  void logActivity({
    campaignId: res.locals.campaign.id,
    actorId: req.session.userId!,
    actionType: "artifact.created",
    entityType: "artifact",
    entityId: artifact.id,
    metadata: { name: artifact.name },
    gmOnly: true,
  });
  req.session.flash = { success: `Artifact "${artifact.name}" created.` };
  res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/${artifact.id}`);
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);
  const results = await searchArtifacts(res.locals.campaign.id, q);
  res.json(results);
});

router.get("/:artifactId", async (req, res) => {
  const artifact = await getArtifactById(req.params.artifactId);
  if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
  }
  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  if (!isGm && !artifact.revealed) {
    return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
  }
  const [campaignLocations, campaignNpcs] = await Promise.all([
    getLocations(res.locals.campaign.id),
    getNpcs(res.locals.campaign.id),
  ]);
  res.render("pages/artifacts/show.njk", {
    title: `${artifact.name} — ${res.locals.campaign.name}`,
    artifact,
    campaignLocations,
    campaignNpcs,
    isGm,
  });
});

router.post(
  "/:artifactId/description",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);
    if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
    }
    const { description } = req.body as { description?: string };
    await updateArtifact(artifact.id, { description });
    req.session.flash = { success: "Description updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/${artifact.id}`);
  }
);

router.post(
  "/:artifactId/status",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);
    if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
    }

    const { status } = req.body as { status: string };
    const validStatuses = ["extant", "lost", "destroyed", "unknown"];
    if (!validStatuses.includes(status)) {
      req.session.flash = { error: "Invalid status." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/${artifact.id}`);
    }

    const updated = await updateArtifactStatus(artifact.id, status as Parameters<typeof updateArtifactStatus>[1]);

    if (req.headers["hx-request"]) {
      return res.render("partials/artifact-status-badge.njk", { artifact: updated });
    }
    res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/${artifact.id}`);
  }
);

router.post(
  "/:artifactId/location",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);
    if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
    }
    const { location_id } = req.body as { location_id: string };
    await updateArtifactLocation(artifact.id, location_id || null);
    req.session.flash = { success: "Location updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/${artifact.id}`);
  }
);

router.post(
  "/:artifactId/npc",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);
    if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
    }
    const { npc_id } = req.body as { npc_id: string };
    // When assigning a holder, sync the artifact's location to the NPC's location.
    let locationId: string | null | undefined;
    if (npc_id) {
      const npc = await getNpcById(npc_id);
      if (npc?.locationId) locationId = npc.locationId;
    }
    await updateArtifactNpc(artifact.id, npc_id || null, locationId);
    req.session.flash = { success: "Holder updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/${artifact.id}`);
  }
);

router.post(
  "/:artifactId/archive",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);
    if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
    }
    await archiveArtifact(artifact.id);
    void logActivity({
      campaignId: res.locals.campaign.id,
      actorId: req.session.userId!,
      actionType: "artifact.archived",
      entityType: "artifact",
      entityId: artifact.id,
      metadata: { name: artifact.name },
      gmOnly: true,
    });
    req.session.flash = { success: `"${artifact.name}" has been archived.` };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts`);
  }
);

router.post(
  "/:artifactId/reveal",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);
    if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
    }
    const revealed = req.body.revealed === "true";
    await updateArtifactRevealed(artifact.id, revealed);
    res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/${artifact.id}`);
  }
);

export default router;
