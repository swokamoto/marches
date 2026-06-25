import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  loadCampaign,
  requireCampaignMember,
} from "../middleware/campaign.js";
import {
  createCampaign,
  getUserCampaigns,
} from "../services/campaigns.js";
import locationsRouter from "./locations.js";
import npcsRouter from "./npcs.js";
import artifactsRouter from "./artifacts.js";
import journalRouter from "./journal.js";
import expeditionsRouter from "./expeditions.js";

const router = Router();

// All campaign routes require authentication
router.use(requireAuth);

// ─── List (user's campaigns) ──────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const userCampaigns = await getUserCampaigns(req.session.userId!);
  res.render("pages/campaigns/index.njk", {
    title: "My Campaigns",
    userCampaigns,
  });
});

// ─── New ──────────────────────────────────────────────────────────────────────

router.get("/new", (_req, res) => {
  res.render("pages/campaigns/new.njk", { title: "New Campaign" });
});

router.post("/new", async (req, res) => {
  const { name, description } = req.body as {
    name: string;
    description?: string;
  };

  if (!name?.trim()) {
    req.session.flash = { error: "Campaign name is required." };
    return res.redirect("/campaigns/new");
  }

  const campaign = await createCampaign(name, description, req.session.userId!);

  req.session.flash = { success: `Campaign "${campaign.name}" created.` };
  res.redirect(`/campaigns/${campaign.slug}`);
});

// ─── Sub-routers (campaign-scoped) ────────────────────────────────────────────
// loadCampaign + requireCampaignMember run here so sub-routers
// always have res.locals.campaign and res.locals.member available.

router.use("/:slug/locations", loadCampaign, requireCampaignMember, locationsRouter);
router.use("/:slug/npcs", loadCampaign, requireCampaignMember, npcsRouter);
router.use("/:slug/artifacts", loadCampaign, requireCampaignMember, artifactsRouter);
router.use("/:slug/journal", loadCampaign, requireCampaignMember, journalRouter);
router.use("/:slug/expeditions", loadCampaign, requireCampaignMember, expeditionsRouter);

// ─── Campaign dashboard ───────────────────────────────────────────────────────
// loadCampaign reads :slug, requireCampaignMember verifies membership.
// Both attach to res.locals so the base layout nav renders correctly.

router.get(
  "/:slug",
  loadCampaign,
  requireCampaignMember,
  (_req, res) => {
    res.render("pages/campaigns/show.njk", {
      title: res.locals.campaign.name,
    });
  }
);

// ─── Activity feed partial (HTMX) ─────────────────────────────────────────────

router.get(
  "/:slug/activity",
  loadCampaign,
  requireCampaignMember,
  (_req, res) => {
    // Stub — real activity log query added in Phase 8
    res.render("partials/activity-feed.njk", { activities: [] });
  }
);

export default router;
