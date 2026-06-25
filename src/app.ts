import express from "express";
import { configureTemplates } from "./templates.js";

const app = express();

// Parse URL-encoded form bodies (used by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (used by HTMX requests that send JSON)
app.use(express.json());

// Serve static files from /public
app.use(express.static("public"));

// Nunjucks template engine
configureTemplates(app);

app.get("/", (_req, res) => {
  res.render("pages/home.njk", { title: "Welcome" });
});

export default app;
