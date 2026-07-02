import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  loadCampaign,
  requireCampaignMember,
  requireCampaignRole,
} from "../middleware/campaign.js";
import {
  createCampaign,
  getUserCampaigns,
  updateCampaign,
} from "../services/campaigns.js";
import locationsRouter from "./locations.js";
import npcsRouter from "./npcs.js";
import artifactsRouter from "./artifacts.js";
import journalRouter from "./journal.js";
import expeditionsRouter from "./expeditions.js";
import sessionsRouter from "./sessions.js";
import charactersRouter from "./characters.js";
import timelineRouter from "./timeline.js";
import membersRouter from "./members.js";
import { getRecentActivity, describeActivity, logActivity } from "../services/activity.js";
import { getExpeditions } from "../services/expeditions.js";
import { getWorldEvents } from "../services/timeline.js";
import { getCampaignByInviteCode, addMember } from "../services/members.js";

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
router.use("/:slug/sessions", loadCampaign, requireCampaignMember, sessionsRouter);
router.use("/:slug/characters", loadCampaign, requireCampaignMember, charactersRouter);
router.use("/:slug/timeline", loadCampaign, requireCampaignMember, timelineRouter);
router.use("/:slug/members", loadCampaign, requireCampaignMember, membersRouter);

// ─── Campaign settings ─────────────────────────────────────────────

router.get(
  "/:slug/settings",
  loadCampaign,
  requireCampaignMember,
  requireCampaignRole("admin"),
  (_req, res) => {
    res.render("pages/campaigns/settings.njk", {
      title: `Settings — ${res.locals.campaign.name}`,
    });
  }
);

router.post(
  "/:slug/settings",
  loadCampaign,
  requireCampaignMember,
  requireCampaignRole("admin"),
  async (req, res) => {
    const { name, description } = req.body as { name: string; description?: string };
    if (!name?.trim()) {
      req.session.flash = { error: "Campaign name is required." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/settings`);
    }
    await updateCampaign(res.locals.campaign.id, { name, description });
    req.session.flash = { success: "Settings saved." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/settings`);
  }
);

// ─── Join campaign via invite code ────────────────────────────────────────────

router.get("/join", (_req, res) => {
  res.render("pages/campaigns/join.njk", { title: "Join a Campaign" });
});

router.post("/join", async (req, res) => {
  const { code } = req.body as { code: string };

  if (!code?.trim()) {
    req.session.flash = { error: "Please enter an invite code." };
    return res.redirect("/campaigns/join");
  }

  const campaign = await getCampaignByInviteCode(code.trim());

  if (!campaign) {
    req.session.flash = { error: "Invalid invite code." };
    return res.redirect("/campaigns/join");
  }

  const newMember = await addMember(campaign.id, req.session.userId!);

  if (!newMember) {
    // onConflictDoNothing returned nothing — user is already a member
    req.session.flash = { error: `You are already a member of ${campaign.name}.` };
    return res.redirect(`/campaigns/${campaign.slug}`);
  }

  void logActivity({
    campaignId: campaign.id,
    actorId: req.session.userId!,
    actionType: "member.joined",
    metadata: {},
    gmOnly: false,
  });

  req.session.flash = { success: `You joined ${campaign.name}!` };
  res.redirect(`/campaigns/${campaign.slug}`);
});

// ─── Campaign dashboard ───────────────────────────────────────────────────────
// loadCampaign reads :slug, requireCampaignMember verifies membership.
// Both attach to res.locals so the base layout nav renders correctly.

router.get(
  "/:slug",
  loadCampaign,
  requireCampaignMember,
  async (_req, res) => {
    const [{ expeditions: expeditionList }, recentEvents] = await Promise.all([
      getExpeditions(res.locals.campaign.id),
      getWorldEvents(res.locals.campaign.id),
    ]);

    const activeExpeditions = expeditionList.filter(
      (e) => ["recruiting", "scheduled", "active"].includes(e.status)
    );

    res.render("pages/campaigns/show.njk", {
      title: res.locals.campaign.name,
      activeExpeditions,
      recentEvents: recentEvents.slice(0, 5),
    });
  }
);

// ─── Activity feed partial (HTMX) ─────────────────────────────────────────────

router.get(
  "/:slug/activity",
  loadCampaign,
  requireCampaignMember,
  async (_req, res) => {
    const raw = await getRecentActivity(
      res.locals.campaign.id,
      ["gm", "admin"].includes(res.locals.member.role)
    );
    const activities = raw.map((item) => ({
      ...item,
      description: describeActivity(item),
    }));
    res.render("partials/activity-feed.njk", { activities });
  }
);

export default router;
