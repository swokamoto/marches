import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  getLocations,
  getLocationBySlug,
  createLocation,
  updateLocationStatus,
  archiveLocation,
  searchLocations,
  updateLocationParent,
  addLocationConnection,
  removeLocationConnection,
} from "../services/locations.js";
import { logActivity } from "../services/activity.js";

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

router.get("/new", requireCampaignRole("gm", "admin"), async (_req, res) => {
  const allLocations = await getLocations(res.locals.campaign.id);
  res.render("pages/locations/new.njk", { title: "New Location", allLocations });
});

router.post("/new", requireCampaignRole("gm", "admin"), async (req, res) => {
  const { name, parent_location_id } = req.body as { name: string; parent_location_id?: string };

  if (!name?.trim()) {
    req.session.flash = { error: "Location name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/locations/new`);
  }

  const location = await createLocation(
    res.locals.campaign.id,
    name,
    req.session.userId!,
    parent_location_id || undefined
  );

  void logActivity({
    campaignId: res.locals.campaign.id,
    actorId: req.session.userId!,
    actionType: "location.created",
    entityType: "location",
    entityId: location.id,
    metadata: { name: location.name },
    gmOnly: true,
  });

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
      status: "404",
      message: "Location not found.",
    });
  }

  const allLocations = await getLocations(res.locals.campaign.id);

  res.render("pages/locations/show.njk", {
    title: `${location.name} — ${res.locals.campaign.name}`,
    location,
    allLocations,
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
        status: "404",
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

// ─── Archive (GM/admin only) ──────────────────────────────────────────────
router.post(
  "/:locationSlug/archive",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const slug = Array.isArray(req.params.locationSlug)
      ? req.params.locationSlug[0]
      : req.params.locationSlug;
    const location = await getLocationBySlug(res.locals.campaign.id, slug);
    if (!location) return res.status(404).render("pages/error.njk", { status: "404", message: "Location not found." });
    await archiveLocation(location.id);
    void logActivity({
      campaignId: res.locals.campaign.id,
      actorId: req.session.userId!,
      actionType: "location.archived",
      entityType: "location",
      entityId: location.id,
      metadata: { name: location.name },
      gmOnly: true,
    });
    req.session.flash = { success: `"${location.name}" has been archived.` };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/locations`);
  }
);

// ─── Parent location ──────────────────────────────────────────────────────────────
router.post(
  "/:locationSlug/parent",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const slug = Array.isArray(req.params.locationSlug) ? req.params.locationSlug[0] : req.params.locationSlug;
    const location = await getLocationBySlug(res.locals.campaign.id, slug);
    if (!location) return res.status(404).render("pages/error.njk", { status: "404", message: "Location not found." });

    const { parent_location_id } = req.body as { parent_location_id?: string };

    // Prevent a location from being its own parent
    if (parent_location_id && parent_location_id === location.id) {
      req.session.flash = { error: "A location cannot be its own parent." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/locations/${location.slug}`);
    }

    await updateLocationParent(location.id, parent_location_id || null);
    req.session.flash = { success: "Parent location updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/locations/${location.slug}`);
  }
);

// ─── Connections ─────────────────────────────────────────────────────────────────
router.post(
  "/:locationSlug/connections/add",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const slug = Array.isArray(req.params.locationSlug) ? req.params.locationSlug[0] : req.params.locationSlug;
    const location = await getLocationBySlug(res.locals.campaign.id, slug);
    if (!location) return res.status(404).render("pages/error.njk", { status: "404", message: "Location not found." });

    const { to_location_id, description } = req.body as { to_location_id: string; description?: string };

    // Validate destination belongs to the campaign
    const allLocations = await getLocations(res.locals.campaign.id);

    const errorHtml = (msg: string) =>
      res.status(400).render("partials/location-connections.njk", {
        location,
        allLocations,
        connectionError: msg,
      });

    if (!to_location_id) {
      return errorHtml("Please select a destination location.");
    }

    if (to_location_id === location.id) {
      return errorHtml("A location cannot connect to itself.");
    }

    if (!allLocations.some((l) => l.id === to_location_id)) {
      return errorHtml("Invalid destination location.");
    }

    await addLocationConnection(location.id, to_location_id, description);
    const updated = await getLocationBySlug(res.locals.campaign.id, slug);
    res.render("partials/location-connections.njk", {
      location: updated,
      allLocations,
    });
  }
);

router.post(
  "/:locationSlug/connections/:connectionId/remove",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const slug = Array.isArray(req.params.locationSlug) ? req.params.locationSlug[0] : req.params.locationSlug;
    const location = await getLocationBySlug(res.locals.campaign.id, slug);
    if (!location) return res.status(404).render("pages/error.njk", { status: "404", message: "Location not found." });

    await removeLocationConnection(String(req.params.connectionId));
    const [updated, allLocations] = await Promise.all([
      getLocationBySlug(res.locals.campaign.id, slug),
      getLocations(res.locals.campaign.id),
    ]);
    res.render("partials/location-connections.njk", {
      location: updated,
      allLocations,
    });
  }
);

export default router;
