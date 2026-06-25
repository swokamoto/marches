import { Router } from "express";
import { registerUser, loginUser } from "../services/auth.js";

const router = Router();

// ─── Register ─────────────────────────────────────────────────────────────────

router.get("/register", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("pages/auth/register.njk", { title: "Create account" });
});

router.post("/register", async (req, res) => {
  const { email, displayName, password, confirmPassword } = req.body as {
    email: string;
    displayName: string;
    password: string;
    confirmPassword: string;
  };

  if (!email || !displayName || !password) {
    req.session.flash = { error: "All fields are required." };
    return res.redirect("/auth/register");
  }

  if (password.length < 8) {
    req.session.flash = { error: "Password must be at least 8 characters." };
    return res.redirect("/auth/register");
  }

  if (password !== confirmPassword) {
    req.session.flash = { error: "Passwords do not match." };
    return res.redirect("/auth/register");
  }

  const result = await registerUser(email, displayName, password);

  if ("error" in result) {
    req.session.flash = { error: "An account with that email already exists." };
    return res.redirect("/auth/register");
  }

  req.session.userId = result.id;
  req.session.flash = { success: `Welcome, ${result.displayName}.` };
  res.redirect("/");
});

// ─── Login ────────────────────────────────────────────────────────────────────

router.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("pages/auth/login.njk", { title: "Sign in" });
});

router.post("/login", async (req, res) => {
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

  req.session.userId = result.id;
  res.redirect("/");
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

export default router;
