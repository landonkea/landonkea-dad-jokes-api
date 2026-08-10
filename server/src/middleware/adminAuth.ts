// This middleware protects admin-only routes (currently: deleting a joke).
// There's no user account system in this app, so we use a simple shared-secret
// header instead: the client must send "x-admin-token" matching the server's
// ADMIN_TOKEN environment variable.
import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";

// Express middleware signature: (req, res, next) => void.
// Call next() to let the request continue to the route handler, or send a
// response yourself to stop it there.
export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  // Fail closed: if the server operator never set ADMIN_TOKEN, we refuse every
  // admin request rather than silently allowing unauthenticated deletes.
  if (!config.adminToken) {
    res.status(503).json({
      success: false,
      error: "Admin actions are disabled (ADMIN_TOKEN is not configured on the server).",
    });
    return;
  }

  // Headers are case-insensitive; Express's req.header() handles that for us.
  const provided = req.header("x-admin-token");

  if (!provided || provided !== config.adminToken) {
    res.status(401).json({
      success: false,
      error: "Missing or invalid x-admin-token header.",
    });
    return;
  }

  // Token matches, let the request proceed to the actual route handler.
  next();
}
