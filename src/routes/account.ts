import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { updateAccountSettings, changePassword } from "../services/auth.js";

const router = Router();

router.use(requireAuth);

// ─── Settings page ────────────────────────────────────────────────────────────

router.get("/", (req, res) => {
  res.render("pages/account/settings.njk", {
    title: "Account Settings",
    user: res.locals.user,
  });
});

// ─── Update display name ──────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { displayName } = req.body as { displayName: string };

  if (!displayName?.trim()) {
    req.session.flash = { error: "Display name cannot be empty." };
    return res.redirect("/account");
  }

  if (displayName.trim().length > 64) {
    req.session.flash = { error: "Display name must be 64 characters or fewer." };
    return res.redirect("/account");
  }

  await updateAccountSettings(req.session.userId!, { displayName });
  req.session.flash = { success: "Display name updated." };
  res.redirect("/account");
});

// ─── Change password ──────────────────────────────────────────────────────────

router.post("/password", async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };

  if (!currentPassword || !newPassword || !confirmPassword) {
    req.session.flash = { error: "All password fields are required." };
    return res.redirect("/account");
  }

  if (newPassword.length < 8) {
    req.session.flash = { error: "New password must be at least 8 characters." };
    return res.redirect("/account");
  }

  if (newPassword !== confirmPassword) {
    req.session.flash = { error: "New passwords do not match." };
    return res.redirect("/account");
  }

  const result = await changePassword(req.session.userId!, currentPassword, newPassword);

  if ("error" in result) {
    req.session.flash = { error: "Current password is incorrect." };
    return res.redirect("/account");
  }

  req.session.flash = { success: "Password changed." };
  res.redirect("/account");
});

export default router;
