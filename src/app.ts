import "dotenv/config";
import express from "express";
import { configureTemplates } from "./templates.js";
import { sessionMiddleware } from "./middleware/session.js";
import { flashMiddleware, loadUser } from "./middleware/locals.js";

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

app.get("/", (_req, res) => {
  res.render("pages/home.njk", { title: "Welcome" });
});

export default app;
