import type { RequestHandler } from "express";
import type { PermissionKey } from "../auth/permissions.js";

export function requirePermission(permission: PermissionKey): RequestHandler {
  return (request, response, next) => {
    if (!request.authUser) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    if (!request.authUser.permissions.includes(permission)) {
      response.status(403).json({ error: "Forbidden." });
      return;
    }

    next();
  };
}