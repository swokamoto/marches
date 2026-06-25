import express from "express";

const app = express();

// Parse URL-encoded form bodies (used by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies (used by HTMX requests that send JSON)
app.use(express.json());

// Serve static files from /public
app.use(express.static("public"));

app.get("/", (_req, res) => {
  res.send("<h1>Marches</h1><p>Campaign management platform.</p>");
});

export default app;
