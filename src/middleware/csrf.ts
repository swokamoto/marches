import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Generates a CSRF token for the session (once) and exposes it as res.locals.csrfToken. */
export function csrfTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

/** Validates the CSRF token for mutating requests. Skip in test environment. */
export function csrfProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.NODE_ENV === "test") return next();
  if (SAFE_METHODS.has(req.method)) return next();

  const sessionToken = req.session.csrfToken;
  // Accept token from form body (_csrf) or custom request header (X-CSRF-Token)
  const requestToken =
    (req.body as Record<string, unknown>)?._csrf ??
    req.headers["x-csrf-token"];

  if (!sessionToken || !requestToken || requestToken !== sessionToken) {
    return res
      .status(403)
      .render("pages/error.njk", {
        status: "403",
        message: "Invalid or missing CSRF token. Please reload and try again.",
      });
  }
  next();
}
