import nunjucks from "nunjucks";
import type { Express } from "express";

export function configureTemplates(app: Express): void {
  const env = nunjucks.configure("views", {
    autoescape: true,
    express: app,
    watch: process.env.NODE_ENV === "development",
  });

  // Custom filter: format a date as "June 25, 2026"
  env.addFilter("dateformat", (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // Custom filter: ISO date string for HTML date inputs (YYYY-MM-DD)
  env.addFilter("dateinput", (date: string | Date | null | undefined) => {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 10);
  });

  // Custom filter: relative time, e.g. "2 hours ago"
  env.addFilter("timeago", (date: string | Date) => {
    const seconds = Math.floor(
      (Date.now() - new Date(date).getTime()) / 1000
    );
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  });

  app.set("view engine", "njk");
}
