import { Router } from "express";
import { registerUser, loginUser } from "../services/auth.js";
import { requireGuest } from "../middleware/auth.js";

const router = Router();

// ─── Register ─────────────────────────────────────────────────────────────────

router.get("/register", requireGuest, (req, res) => {
  res.render("pages/auth/register.njk", { title: "Create account" });
});

router.post("/register", requireGuest, async (req, res, next) => {
  const { email, displayName, password, confirmPassword } = req.body as {
    email: string;
    displayName: string;
    password: string;
    confirmPassword: string;
  };

  const formData = { email: email?.trim() ?? "", displayName: displayName?.trim() ?? "" };

  if (!email || !displayName || !password) {
    return res.render("pages/auth/register.njk", {
      title: "Create account",
      error: "All fields are required.",
      formData,
    });
  }

  if (password.length < 8) {
    return res.render("pages/auth/register.njk", {
      title: "Create account",
      error: "Password must be at least 8 characters.",
      formData,
    });
  }

  if (password !== confirmPassword) {
    return res.render("pages/auth/register.njk", {
      title: "Create account",
      error: "Passwords do not match.",
      formData,
    });
  }

  const result = await registerUser(email, displayName, password);

  if ("error" in result) {
    return res.render("pages/auth/register.njk", {
      title: "Create account",
      error: "An account with that email already exists.",
      formData,
    });
  }

  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = result.id;
    req.session.flash = { success: `Welcome, ${result.displayName}.` };
    res.redirect("/");
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

router.get("/login", requireGuest, (req, res) => {
  res.render("pages/auth/login.njk", { title: "Sign in" });
});

router.post("/login", requireGuest, async (req, res, next) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    req.session.flash = { error: "Email and password are required." };
    return res.redirect("/auth/login");
  }

  const result = await loginUser(email, password);

  if ("error" in result) {
    // Intentionally vague — don't reveal whether the email exists
    req.session.flash = { error: "Invalid email or password." };
    return res.redirect("/auth/login");
  }

  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = result.id;
    res.redirect("/");
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

export default router;
