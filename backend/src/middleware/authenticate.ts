import type { RequestHandler } from "express";
import { SESSION_COOKIE_NAME } from "../auth/csrf.js";
import type { AuthService } from "../auth/service.js";

export function authenticate(authService: AuthService): RequestHandler {
  return async (request, response, next) => {
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const user = await authService.authenticate(token);
      if (!user) {
        response.status(401).json({ error: "Authentication required." });
        return;
      }

      request.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}