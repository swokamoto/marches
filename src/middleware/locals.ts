import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

// Reads flash from session, exposes it as res.locals.flash, then clears it.
// Must run after session middleware.
export function flashMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.locals.flash = req.session.flash ?? null;
  res.locals.requestPath = req.path === "/" ? req.path : req.path.replace(/\/$/, "");
  delete req.session.flash;
  next();
}

// Loads the authenticated user from the session and attaches to res.locals.
// Every template automatically gets `user` if the request is authenticated.
export async function loadUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  res.locals.user = null;

  if (!req.session.userId) {
    return next();
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId),
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
        email: true,
      },
    });

    res.locals.user = user ?? null;

    // Session references a deleted user — clear it and send them to login
    if (!user) {
      req.session.destroy(() => {
        res.redirect("/auth/login");
      });
      return;
    }
  } catch {
    // DB error — proceed without user rather than crashing the request
  }

  next();
}
