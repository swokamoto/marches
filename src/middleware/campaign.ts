import type { Request, Response, NextFunction } from "express";
import { getCampaignBySlug, getCampaignMember } from "../services/campaigns.js";

// Loads campaign from :slug param, attaches to res.locals.
// Must run before requireCampaignMember.
export async function loadCampaign(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { slug } = req.params;
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  if (!slugStr) {
    res.status(400).render("pages/error.njk", { message: "Missing campaign slug." });
    return;
  }

  const campaign = await getCampaignBySlug(slugStr);

  if (!campaign) {
    res.status(404).render("pages/error.njk", { message: "Campaign not found." });
    return;
  }

  res.locals.campaign = campaign;
  next();
}

// Verifies the current user is a member of res.locals.campaign.
// Attaches their membership as res.locals.member.
// Must run after loadCampaign and requireAuth.
export async function requireCampaignMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const campaign = res.locals.campaign;
  const userId = req.session.userId!;

  const member = await getCampaignMember(campaign.id, userId);

  if (!member) {
    res.status(403).render("pages/error.njk", {
      message: "You are not a member of this campaign.",
    });
    return;
  }

  res.locals.member = member;
  next();
}

// Returns middleware that allows only the specified roles.
// Must run after requireCampaignMember.
//
// Usage:
//   router.post('/settings', requireCampaignRole('admin'), handler)
//   router.post('/expedition', requireCampaignRole('gm', 'admin'), handler)
export function requireCampaignRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const member = res.locals.member;
    if (member && roles.includes(member.role)) {
      return next();
    }
    res.status(403).render("pages/error.njk", {
      message: "You do not have permission to perform this action.",
    });
  };
}
