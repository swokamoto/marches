import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  createSession,
  getSessionById,
  getSessionsForCampaign,
  updateSessionStatus,
  getOrCreateReport,
  submitPlayerNote,
  isSessionParticipant,
} from "../services/sessions.js";
import {
  addWorldChange,
  removeWorldChange,
  publishReport,
} from "../services/world-changes.js";
import type { WorldChangeType } from "../services/world-changes.js";
import { getLocations } from "../services/locations.js";
import { getNpcs } from "../services/npcs.js";
import { logActivity } from "../services/activity.js";

const router = Router({ mergeParams: true });

const VALID_CHANGE_TYPES: WorldChangeType[] = [
  "location_status_change",
  "discovery",
  "npc_status_change",
  "npc_defeated",
  "structure_built",
  "structure_destroyed",
  "route_opened",
  "route_closed",
  "faction_event",
  "custom",
];

// ─── Create session (called from expedition detail) ───────────────────────────
// Mounted at POST /campaigns/:slug/expeditions/:expeditionId/sessions/create
// via the expeditions router passing through to sessions.

export async function createSessionHandler(
  req: import("express").Request,
  res: import("express").Response
): Promise<void> {
  const { campaign_day } = req.body as { campaign_day?: string };

  const session = await createSession({
    expeditionId: req.params.expeditionId as string,
    gmId: req.session.userId!,
    campaignId: res.locals.campaign.id,
    campaignDay: campaign_day ? parseInt(campaign_day) : undefined,
    playedAt: new Date(),
  });

  req.session.flash = { success: "Session started." };
  res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
}

// ─── Campaign sessions index ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const sessions = await getSessionsForCampaign(res.locals.campaign.id);
  res.render("pages/sessions/index.njk", { title: "Sessions", sessions });
});

// ─── Session detail ───────────────────────────────────────────────────────────

router.get("/:sessionId", async (req, res) => {
  const session = await getSessionById(req.params.sessionId as string);

  if (!session || session.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { message: "Session not found." });
  }

  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const isParticipant = await isSessionParticipant(session.id, req.session.userId!);

  // GMs always see full report + world changes
  // Participants see the report once published, plus their own note form
  if (!isGm && !isParticipant) {
    return res.status(403).render("pages/error.njk", {
      message: "You were not part of this session.",
    });
  }

  const [campaignLocations, campaignNpcs] = await Promise.all([
    getLocations(res.locals.campaign.id),
    getNpcs(res.locals.campaign.id),
  ]);

  // Find if this player already submitted a note
  const myNote = session.playerNotes.find((n) => n.playerId === req.session.userId!);

  // Find this player's participant character
  const myParticipant = session.participants.find(
    (p) => p.character.player.id === req.session.userId!
  );

  res.render("pages/sessions/show.njk", {
    title: `Session — ${session.expedition.title}`,
    session,
    isGm,
    isParticipant,
    myNote,
    myParticipant,
    campaignLocations,
    campaignNpcs,
  });
});

// ─── Save report narrative (journal entry on session entity) ──────────────────
// The narrative lives in journal_entries — the report record just holds
// world changes and publish status.

router.post(
  "/:sessionId/report/open",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Session not found." });
    }

    await getOrCreateReport(session.id, req.session.userId!);
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

// ─── World changes (add / remove) ────────────────────────────────────────────

router.post(
  "/:sessionId/world-changes/add",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Session not found." });
    }

    const report = await getOrCreateReport(session.id, req.session.userId!);

    const {
      change_type,
      entity_type,
      entity_id,
      description,
      new_status,
    } = req.body as {
      change_type: string;
      entity_type?: string;
      entity_id?: string;
      description: string;
      new_status?: string;
    };

    if (!VALID_CHANGE_TYPES.includes(change_type as WorldChangeType)) {
      return res.status(400).send("Invalid change type.");
    }

    if (!description?.trim()) {
      return res.status(400).send("Description is required.");
    }

    const metadata: Record<string, string> = {};
    if (new_status) metadata.new_status = new_status;

    await addWorldChange({
      sessionReportId: report.id,
      changeType: change_type as WorldChangeType,
      entityType: entity_type ?? "campaign",
      entityId: entity_id || undefined,
      description,
      metadata: Object.keys(metadata).length ? metadata : undefined,
      createdBy: req.session.userId!,
    });

    const updatedSession = await getSessionById(session.id);
    res.render("partials/world-changes-list.njk", {
      session: updatedSession,
      report: updatedSession?.report,
    });
  }
);

router.post(
  "/:sessionId/world-changes/:changeId/remove",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Session not found." });
    }

    if (!session.report) {
      return res.status(400).send("No report found.");
    }

    await removeWorldChange(req.params.changeId as string, session.report.id);

    const updatedSession = await getSessionById(session.id);
    res.render("partials/world-changes-list.njk", {
      session: updatedSession,
      report: updatedSession?.report,
    });
  }
);

// ─── Publish ──────────────────────────────────────────────────────────────────

router.get(
  "/:sessionId/publish",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Session not found." });
    }

    res.render("pages/sessions/publish-confirm.njk", {
      title: "Publish Report",
      session,
    });
  }
);

router.post(
  "/:sessionId/publish",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Session not found." });
    }

    if (!session.report) {
      req.session.flash = { error: "No report to publish." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
    }

    await publishReport(
      session.report.id,
      session.id,
      session.campaignId,
      session.campaignDay ?? undefined,
      req.session.userId!
    );

    // Advance session to awaiting player notes
    await updateSessionStatus(session.id, "awaiting_notes");

    void logActivity({
      campaignId: session.campaignId,
      actorId: req.session.userId!,
      actionType: "session.report_published",
      entityType: "session",
      entityId: session.id,
      metadata: { expeditionTitle: session.expedition.title },
    });

    req.session.flash = {
      success: `Report published. ${session.report.worldChanges.filter(c => c.status === "pending").length} world event(s) created.`,
    };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

// ─── Player notes ─────────────────────────────────────────────────────────────

router.post("/:sessionId/notes", async (req, res) => {
  const session = await getSessionById(req.params.sessionId as string);
  if (!session || session.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { message: "Session not found." });
  }

  const participant = await isSessionParticipant(session.id, req.session.userId!);
  if (!participant) {
    return res.status(403).render("pages/error.njk", {
      message: "Only session participants can submit notes.",
    });
  }

  const { body, character_id } = req.body as {
    body: string;
    character_id?: string;
  };

  if (!body?.trim()) {
    req.session.flash = { error: "Note cannot be empty." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }

  await submitPlayerNote(
    session.id,
    req.session.userId!,
    character_id || undefined,
    body
  );

  // Check if all participants have submitted notes — auto-close if so
  const updatedSession = await getSessionById(session.id);
  const participantIds = updatedSession!.participants.map((p) => p.character.player.id);
  const noteIds = updatedSession!.playerNotes.map((n) => n.playerId);
  const allSubmitted = participantIds.every((id) => noteIds.includes(id));

  if (allSubmitted && session.status === "awaiting_notes") {
    await updateSessionStatus(session.id, "closed");
    req.session.flash = { success: "Note submitted. Session is now closed." };
  } else {
    req.session.flash = { success: "Note submitted." };
  }

  res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
});

// ─── World change conditional fields (HTMX) ──────────────────────────────────

router.get("/:sessionId/world-change-fields", requireCampaignRole("gm", "admin"), async (req, res) => {
  const changeType = String(req.query.change_type ?? "");
  const [campaignLocations, campaignNpcs] = await Promise.all([
    getLocations(res.locals.campaign.id),
    getNpcs(res.locals.campaign.id),
  ]);
  res.render("partials/world-change-fields.njk", {
    changeType,
    campaignLocations,
    campaignNpcs,
  });
});

// ─── Manual close (GM) ────────────────────────────────────────────────────────

router.post(
  "/:sessionId/close",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Session not found." });
    }

    await updateSessionStatus(session.id, "closed");

    void logActivity({
      campaignId: session.campaignId,
      actorId: req.session.userId!,
      actionType: "session.closed",
      entityType: "session",
      entityId: session.id,
      metadata: { expeditionTitle: session.expedition.title },
    });

    req.session.flash = { success: "Session closed." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

export default router;
