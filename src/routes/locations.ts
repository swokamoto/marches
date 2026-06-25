import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  getLocations,
  getLocationBySlug,
  createLocation,
  updateLocationStatus,
  searchLocations,
} from "../services/locations.js";

// mergeParams: true gives access to :slug from the parent campaigns router
const router = Router({ mergeParams: true });

// ─── List ─────────────────────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  const locationList = await getLocations(res.locals.campaign.id);
  res.render("pages/locations/index.njk", {
    title: `Locations — ${res.locals.campaign.name}`,
    locationList,
  });
});

// ─── New ──────────────────────────────────────────────────────────────────────

router.get("/new", requireCampaignRole("gm", "admin"), (_req, res) => {
  res.render("pages/locations/new.njk", { title: "New Location" });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { name } = req.body as { name: string };

  if (!name?.trim()) {
    req.session.flash = { error: "Location name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/locations/new`);
  }

  const location = await createLocation(
    res.locals.campaign.id,
    name,
    req.session.userId!
  );

  req.session.flash = { success: `Location "${location.name}" created.` };
  res.redirect(
    `/campaigns/${res.locals.campaign.slug}/locations/${location.slug}`
  );
});

// ─── Autocomplete search (HTMX) ───────────────────────────────────────────────

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);
  const results = await searchLocations(res.locals.campaign.id, q);
  res.json(results);
});

// ─── Detail ───────────────────────────────────────────────────────────────────

router.get("/:locationSlug", async (req, res) => {
  const location = await getLocationBySlug(
    res.locals.campaign.id,
    req.params.locationSlug
  );

  if (!location) {
    return res.status(404).render("pages/error.njk", {
      message: "Location not found.",
    });
  }

  res.render("pages/locations/show.njk", {
    title: `${location.name} — ${res.locals.campaign.name}`,
    location,
  });
});

// ─── Status update (GM/admin only) ────────────────────────────────────────────

router.post(
  "/:locationSlug/status",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const locationSlug = Array.isArray(req.params.locationSlug)
      ? req.params.locationSlug[0]
      : req.params.locationSlug;

    const location = await getLocationBySlug(
      res.locals.campaign.id,
      locationSlug
    );

    if (!location) {
      return res.status(404).render("pages/error.njk", {
        message: "Location not found.",
      });
    }

    const { status } = req.body as { status: string };
    const validStatuses = ["open", "active", "ruined", "destroyed", "unknown"];

    if (!validStatuses.includes(status)) {
      req.session.flash = { error: "Invalid status." };
      return res.redirect(
        `/campaigns/${res.locals.campaign.slug}/locations/${location.slug}`
      );
    }

    await updateLocationStatus(location.id, status as Parameters<typeof updateLocationStatus>[1]);

    // HTMX partial swap — return just the updated status badge
    if (req.headers["hx-request"]) {
      return res.render("partials/location-status-badge.njk", { location: { ...location, status } });
    }

    res.redirect(
      `/campaigns/${res.locals.campaign.slug}/locations/${location.slug}`
    );
  }
);

export default router;
