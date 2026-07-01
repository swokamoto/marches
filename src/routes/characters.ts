import { Router } from "express";
import { requireCampaignRole } from "../middleware/campaign.js";
import {
  getCharacters,
  getPlayerCharacters,
  getCharacterById,
  createCharacter,
  updateCharacter,
  updateCharacterStatus,
} from "../services/characters.js";
import type { CharacterStatus } from "../services/characters.js";

const router = Router({ mergeParams: true });

const VALID_STATUSES: CharacterStatus[] = ["active", "retired", "dead"];

// ─── Index ────────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const isGm = ["gm", "admin"].includes(res.locals.member.role);

  // GMs see all characters; players see only their own
  const characterList = isGm
    ? await getCharacters(res.locals.campaign.id)
    : await getPlayerCharacters(res.locals.campaign.id, req.session.userId!);

  res.render("pages/characters/index.njk", {
    title: `Characters — ${res.locals.campaign.name}`,
    characterList,
    isGm,
  });
});

// ─── New ──────────────────────────────────────────────────────────────────────

router.get("/new", (_req, res) => {
  // Any member can create a character for themselves
  res.render("pages/characters/new.njk", { title: "New Character" });
});

router.post("/new", async (req, res) => {
  const { name, description } = req.body as {
    name: string;
    description?: string;
  };

  if (!name?.trim()) {
    req.session.flash = { error: "Character name is required." };
    return res.redirect(`/campaigns/${res.locals.campaign.slug}/characters/new`);
  }

  const character = await createCharacter({
    campaignId: res.locals.campaign.id,
    playerId: req.session.userId!,
    name,
    description,
  });

  req.session.flash = { success: `Character "${character.name}" created.` };
  res.redirect(`/campaigns/${res.locals.campaign.slug}/characters/${character.id}`);
});

// ─── Show ─────────────────────────────────────────────────────────────────────

router.get("/:characterId", async (req, res) => {
  const characterId = Array.isArray(req.params.characterId)
    ? req.params.characterId[0]
    : req.params.characterId;

  const character = await getCharacterById(characterId);
  if (!character || character.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { message: "Character not found." });
  }

  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const isOwner = character.playerId === req.session.userId!;

  if (!isGm && !isOwner) {
    return res.status(403).render("pages/error.njk", {
      message: "You don't have access to this character.",
    });
  }

  res.render("pages/characters/show.njk", {
    title: `${character.name} — ${res.locals.campaign.name}`,
    character,
    isGm,
    isOwner,
  });
});

// ─── Edit ─────────────────────────────────────────────────────────────────────

router.get("/:characterId/edit", async (req, res) => {
  const characterId = Array.isArray(req.params.characterId)
    ? req.params.characterId[0]
    : req.params.characterId;

  const character = await getCharacterById(characterId);
  if (!character || character.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { message: "Character not found." });
  }

  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const isOwner = character.playerId === req.session.userId!;

  if (!isGm && !isOwner) {
    return res.status(403).render("pages/error.njk", {
      message: "You can only edit your own characters.",
    });
  }

  res.render("pages/characters/edit.njk", {
    title: `Edit ${character.name}`,
    character,
  });
});

router.post("/:characterId/edit", async (req, res) => {
  const characterId = Array.isArray(req.params.characterId)
    ? req.params.characterId[0]
    : req.params.characterId;

  const character = await getCharacterById(characterId);
  if (!character || character.campaignId !== res.locals.campaign.id) {
    return res.status(404).render("pages/error.njk", { message: "Character not found." });
  }

  const isGm = ["gm", "admin"].includes(res.locals.member.role);
  const isOwner = character.playerId === req.session.userId!;

  if (!isGm && !isOwner) {
    return res.status(403).render("pages/error.njk", {
      message: "You can only edit your own characters.",
    });
  }

  const { name, description } = req.body as {
    name: string;
    description?: string;
  };

  if (!name?.trim()) {
    req.session.flash = { error: "Character name is required." };
    return res.redirect(
      `/campaigns/${res.locals.campaign.slug}/characters/${character.id}/edit`
    );
  }

  await updateCharacter(character.id, { name, description });
  req.session.flash = { success: "Character updated." };
  res.redirect(`/campaigns/${res.locals.campaign.slug}/characters/${character.id}`);
});

// ─── Status update (GM only) ──────────────────────────────────────────────────

router.post(
  "/:characterId/status",
  requireCampaignRole("gm", "admin"),
  async (req, res) => {
    const characterId = Array.isArray(req.params.characterId)
      ? req.params.characterId[0]
      : req.params.characterId;

    const character = await getCharacterById(characterId);
    if (!character || character.campaignId !== res.locals.campaign.id) {
      return res.status(404).render("pages/error.njk", { message: "Character not found." });
    }

    const { status } = req.body as { status: string };
    if (!VALID_STATUSES.includes(status as CharacterStatus)) {
      req.session.flash = { error: "Invalid status." };
      return res.redirect(
        `/campaigns/${res.locals.campaign.slug}/characters/${character.id}`
      );
    }

    const updated = await updateCharacterStatus(character.id, status as CharacterStatus);

    if (req.headers["hx-request"]) {
      return res.render("partials/character-status-badge.njk", { character: updated });
    }
    res.redirect(`/campaigns/${res.locals.campaign.slug}/characters/${character.id}`);
  }
);

export default router;
