import "dotenv/config";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { configureTemplates } from "./templates.js";
import { sessionMiddleware } from "./middleware/session.js";
import { flashMiddleware, loadUser } from "./middleware/locals.js";
import { requireAuth } from "./middleware/auth.js";
import authRouter from "./routes/auth.js";
import campaignsRouter from "./routes/campaigns.js";
import accountRouter from "./routes/account.js";

const app = express();

// ─── Rate limiting ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: "Too many attempts — please try again in 15 minutes.",
  skip: () => process.env.NODE_ENV === "test",
});

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// ─── Session + locals ─────────────────────────────────────────────────────────

app.use(sessionMiddleware);
app.use(flashMiddleware);
app.use(loadUser);

configureTemplates(app);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/auth", authLimiter, authRouter);
app.use("/campaigns", campaignsRouter);
app.use("/account", accountRouter);

app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.render("pages/home.njk", { title: "Welcome" });
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.render("pages/dashboard.njk", { title: "Dashboard" });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).render("pages/error.njk", {
    status: "404",
    message: "Page not found.",
  });
});

// ─── 500 ──────────────────────────────────────────────────────────────────────
// Express 5 catches async errors automatically — this handles them.

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).render("pages/error.njk", {
      status: "500",
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong. Please try again."
          : err.message,
    });
  }
);

export default app;
