import type { Request, Response, NextFunction } from "express";

// Redirect unauthenticated requests to login.
// Usage: router.get('/protected', requireAuth, handler)
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.session.userId) {
    return next();
  }
  req.session.flash = { error: "You must be signed in to access that page." };
  res.redirect("/auth/login");
}

// Redirect authenticated users away from guest-only pages (login, register).
// Usage: router.get('/auth/login', requireGuest, handler)
export function requireGuest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.userId) {
    return next();
  }
  res.redirect("/");
}
