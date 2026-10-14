import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { SESSION_TTL_SECONDS } from "../auth/token.js";
import { AuthService, InvalidCredentialsError } from "../auth/service.js";
import {
  clearAuthCookies,
  CSRF_COOKIE_NAME,
  newCsrfToken,
  requireCsrf,
  SESSION_COOKIE_NAME,
  setCsrfCookie,
} from "../auth/csrf.js";
import { authenticate } from "../middleware/authenticate.js";

const loginSchema = z.object({
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

interface AuthRouterOptions {
  authService: AuthService;
  secureCookies: boolean;
}

export function createAuthRouter({ authService, secureCookies }: AuthRouterOptions): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({ error: "Too many login attempts. Try again later." });
    },
  });

  router.get("/csrf", (_request, response) => {
    const token = newCsrfToken();
    setCsrfCookie(response, token, secureCookies);
    response.json({ csrfToken: token });
  });

  router.post("/login", loginLimiter, requireCsrf, async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid request." });
      return;
    }

    try {
      const session = await authService.login(parsed.data.email, parsed.data.password);
      response.cookie(SESSION_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "strict",
        path: "/api",
        maxAge: SESSION_TTL_SECONDS * 1000,
      });
      response.json({ user: session.user });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        response.status(401).json({ error: "Invalid email or password." });
        return;
      }
      next(error);
    }
  });

  router.get("/me", authenticate(authService), (request, response) => {
    response.json({ user: request.authUser });
  });

  router.post(
    "/logout",
    authenticate(authService),
    requireCsrf,
    async (request, response, next) => {
      try {
        const user = request.authUser;
        if (!user) {
          response.status(401).json({ error: "Authentication required." });
          return;
        }

        await authService.logout(user.id);
        clearAuthCookies(response, secureCookies);
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export { CSRF_COOKIE_NAME };