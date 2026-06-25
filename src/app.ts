import "dotenv/config";
import express from "express";
import { configureTemplates } from "./templates.js";
import { sessionMiddleware } from "./middleware/session.js";
import { flashMiddleware, loadUser } from "./middleware/locals.js";
import { requireAuth } from "./middleware/auth.js";
import authRouter from "./routes/auth.js";
import campaignsRouter from "./routes/campaigns.js";

const app = express();

// Parse URL-encoded form bodies (used by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (used by HTMX requests that send JSON)
app.use(express.json());

// Serve static files from /public
app.use(express.static("public"));

// Session — must come before flash and loadUser
app.use(sessionMiddleware);

// Flash messages + authenticated user on every request
app.use(flashMiddleware);
app.use(loadUser);

// Nunjucks template engine
configureTemplates(app);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/auth", authRouter);
app.use("/campaigns", campaignsRouter);

// Authenticated users go to dashboard; guests see the landing page
app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.render("pages/home.njk", { title: "Welcome" });
});

// Dashboard — protected, stub until Phase 4
app.get("/dashboard", requireAuth, (req, res) => {
  res.render("pages/dashboard.njk", { title: "Dashboard" });
});

export default app;
