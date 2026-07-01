import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  getMembers,
  getOrCreateInviteCode,
  rotateInviteCode,
  updateMemberRole,
  removeMember,
  VALID_ROLES,
} from "../services/members.js";
import type { CampaignMemberRole } from "../services/members.js";

const router = Router({ mergeParams: true });

// ─── Members list + invite code (GM/admin only) ───────────────────────────────

router.get("/", requireCampaignRole("gm", "admin"), async (_req, res) => {
  const [memberList, inviteCode] = await Promise.all([
    getMembers(res.locals.campaign.id),
    getOrCreateInviteCode(res.locals.campaign.id),
  ]);

  res.render("pages/members/index.njk", {
    title: `Members — ${res.locals.campaign.name}`,
    memberList,
    inviteCode,
  });
});

// ─── Rotate invite code ───────────────────────────────────────────────────────

router.post(
  "/invite/rotate",
  requireCampaignRole("gm", "admin"),
  async (_req, res) => {
    const newCode = await rotateInviteCode(res.locals.campaign.id);

    if (_req.headers["hx-request"]) {
      return res.render("partials/invite-code.njk", {
        inviteCode: newCode,
        campaign: res.locals.campaign,
      });
    }
    res.redirect(`/campaigns/${res.locals.campaign.slug}/members`);
  }
);

// ─── Update role ──────────────────────────────────────────────────────────────

router.post(
  "/:userId/role",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const targetUserId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    // Cannot change your own role
    if (targetUserId === req.session.userId) {
      req.session.flash = { error: "You cannot change your own role." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/members`);
    }

    const { role } = req.body as { role: string };
    if (!VALID_ROLES.includes(role as CampaignMemberRole)) {
      req.session.flash = { error: "Invalid role." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/members`);
    }

    await updateMemberRole(
      res.locals.campaign.id,
      targetUserId,
      role as CampaignMemberRole
    );

    req.session.flash = { success: "Role updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/members`);
  }
);

// ─── Remove member ────────────────────────────────────────────────────────────

router.post(
  "/:userId/remove",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const targetUserId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    // Cannot remove yourself
    if (targetUserId === req.session.userId) {
      req.session.flash = { error: "You cannot remove yourself." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/members`);
    }

    await removeMember(res.locals.campaign.id, targetUserId);
    req.session.flash = { success: "Member removed." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/members`);
  }
);

export default router;
