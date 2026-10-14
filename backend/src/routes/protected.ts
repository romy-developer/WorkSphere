import { Router } from "express";
import type { AuthService } from "../auth/service.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/require-permission.js";

export function createProtectedRouter(authService: AuthService): Router {
  const router = Router();

  router.get(
    "/dashboard",
    authenticate(authService),
    requirePermission("dashboard.view"),
    (request, response) => {
      response.json({ message: `Welcome, ${request.authUser?.name ?? "user"}.` });
    },
  );

  router.get(
    "/access-control",
    authenticate(authService),
    requirePermission("roles.manage"),
    async (_request, response, next) => {
      try {
        response.json({ roles: await authService.listRoleMatrix() });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}