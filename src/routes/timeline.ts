import { Router } from "express";
import { getWorldEvents } from "../services/timeline.js";

const router = Router({ mergeParams: true });

router.get("/", async (_req, res) => {
  const events = await getWorldEvents(res.locals.campaign.id);

  res.render("pages/timeline/index.njk", {
    title: `Timeline — ${res.locals.campaign.name}`,
    events,
  });
});

export default router;
