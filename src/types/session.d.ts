// Augment express-session to add our session fields.
// This file must be imported somewhere in the app to take effect.
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    csrfToken: string;
    flash?: {
      error?: string;
      success?: string;
    };
  }
}
