import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  createSession,
  getSessionById,
  getSessionsForCampaign,
  updateSessionStatus,
  updateSessionSchedule,
  addSessionParticipant,
  removeSessionParticipant,
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
import { getExpeditionById, addExpeditionParticipant, getPlayerCharactersForCampaign } from "../services/expeditions.js";
import { getCharacters } from "../services/characters.js";
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

// ─── Campaign sessions index ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const sessions = await getSessionsForCampaign(res.locals.campaign.id);
  res.render("pages/sessions/index.njk", { title: "Sessions", sessions });
});

// ─── Session detail ───────────────────────────────────────────────────────────

router.get("/:sessionId", async (req, res) => {
  const session = await getSessionById(req.params.sessionId as string);

  if (!session || session.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
  }

  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const isParticipant = await isSessionParticipant(session.id, req.session.userId!);

  // GMs always see full report + world changes
  // Participants see the report once published, plus their own note form
  if (!isGm && !isParticipant) {
    return res.status(403).render("pages/error.njk", {
      status: "403",
      message: "You were not part of this session.",
    });
  }

  const [campaignLocations, campaignNpcs, allCampaignCharacters, myActiveCharacters] = await Promise.all([
    getLocations(res.locals.campaign.id),
    getNpcs(res.locals.campaign.id),
    isGm ? getCharacters(res.locals.campaign.id) : Promise.resolve([]),
    !isGm ? getPlayerCharactersForCampaign(res.locals.campaign.id, req.session.userId!) : Promise.resolve([]),
  ]);

  // GM dropdown: all active campaign characters not already in this session
  const sessionCharacterIds = new Set(session.participants.map((p) => p.characterId));
  const availableToAdd = isGm
    ? allCampaignCharacters.filter((c) => !sessionCharacterIds.has(c.id))
    : [];

  // Player join: their active characters not already in this session
  const myJoinableCharacters = myActiveCharacters.filter((c) => !sessionCharacterIds.has(c.id));

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
    availableToAdd,
    myJoinableCharacters,
    campaignLocations,
    campaignNpcs,
  });
});

// ─── Schedule (campaign day + date) ──────────────────────────────────────────

router.post(
  "/:sessionId/schedule",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
    }
    const { campaign_day, played_at } = req.body as { campaign_day?: string; played_at?: string };
    const campaignDay = campaign_day ? parseInt(campaign_day) : null;
    const playedAt = played_at ? new Date(played_at) : null;
    await updateSessionSchedule(session.id, campaignDay, playedAt);
    req.session.flash = { success: "Session updated." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

// ─── Participants ─────────────────────────────────────────────────────────────

router.post(
  "/:sessionId/participants/add",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
    }
    const { character_id } = req.body as { character_id: string };
    if (character_id) {
      await addSessionParticipant(session.id, character_id);
      // Also add to expedition roster if not already there
      await addExpeditionParticipant(session.expeditionId, character_id);
    }
    req.session.flash = { success: "Participant added." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

router.post(
  "/:sessionId/participants/remove",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
    }
    const { character_id } = req.body as { character_id: string };
    if (character_id) await removeSessionParticipant(session.id, character_id);
    req.session.flash = { success: "Participant removed." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

// Players self-join an open session
router.post(
  "/:sessionId/join",
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
    }
    if (session.status === "closed") {
      req.session.flash = { error: "This session is already closed." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
    }
    const { character_id } = req.body as { character_id: string };
    const myCharacters = await getPlayerCharactersForCampaign(res.locals.campaign.id, req.session.userId!);
    if (!myCharacters.some((c) => c.id === character_id)) {
      return res.status(403).render("pages/error.njk", { status: "403", message: "Character not found." });
    }
    await addSessionParticipant(session.id, character_id);
    // Also add to expedition roster so they appear in world changes / reports
    await addExpeditionParticipant(session.expeditionId, character_id);
    req.session.flash = { success: "You've joined this session." };
    res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
  }
);

// ─── Save report narrative (journal entry on session entity) ──────────────────
// The narrative lives in journal_entries — the report record just holds
// world changes and publish status.

router.post(
  "/:sessionId/report/open",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const session = await getSessionById(req.params.sessionId as string);
    if (!session || session.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
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
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
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
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
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
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
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
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
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
    return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
  }

  const participant = await isSessionParticipant(session.id, req.session.userId!);
  if (!participant) {
    return res.status(403).render("pages/error.njk", {
      status: "403",
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
      return res.status(404).render("pages/error.njk", { status: "404", message: "Session not found." });
    }

    if (session.status === "closed") {
      req.session.flash = { error: "Session is already closed." };
      return res.redirect(`/campaigns/${res.locals.campaign.slug}/sessions/${session.id}`);
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
