import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import { getArtifactsPaginated, getArtifactById, createArtifact, updateArtifact, updateArtifactStatus, searchArtifacts, updateArtifactLocation, archiveArtifact } from "../services/artifacts.js";
import { getLocations } from "../services/locations.js";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const { artifacts: artifactList, total, totalPages } = await getArtifactsPaginated(res.locals.campaign.id, page);
  res.render("pages/artifacts/index.njk", {
    title: `Artifacts — ${res.locals.campaign.name}`,
    artifactList,
    page,
    total,
    totalPages,
  });
});

router.get("/new", requireCampaignRole("gm", "admin"), (_req, res) => {
  res.render("pages/artifacts/new.njk", { title: "New Artifact" });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name?.trim()) {
    req.session.flash = { error: "Artifact name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts/new`);
  }
  const artifact = await createArtifact(res.locals.campaign.id, name, req.session.userId!, description);
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
  const campaignLocations = await getLocations(res.locals.campaign.id);
  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  res.render("pages/artifacts/show.njk", {
    title: `${artifact.name} — ${res.locals.campaign.name}`,
    artifact,
    campaignLocations,
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
  "/:artifactId/archive",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const artifactId = Array.isArray(req.params.artifactId) ? req.params.artifactId[0] : req.params.artifactId;
    const artifact = await getArtifactById(artifactId);
    if (!artifact || artifact.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Artifact not found." });
    }
    await archiveArtifact(artifact.id);
    req.session.flash = { success: `"${artifact.name}" has been archived.` };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/artifacts`);
  }
);

export default router;
