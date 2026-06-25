import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createCampaign,
  getUserCampaigns,
} from "../services/campaigns.js";

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

export default router;
