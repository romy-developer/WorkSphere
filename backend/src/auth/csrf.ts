import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, RequestHandler, Response } from "express";

export const SESSION_COOKIE_NAME = "worksphere_session";
export const CSRF_COOKIE_NAME = "worksphere_csrf";
const CSRF_COOKIE_TTL_MS = 2 * 60 * 60 * 1000;

export function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function setCsrfCookie(response: Response, token: string, secure: boolean): void {
  response.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/api",
    maxAge: CSRF_COOKIE_TTL_MS,
  });
}

export function clearAuthCookies(response: Response, secure: boolean): void {
  const sharedOptions: CookieOptions = {
    secure,
    sameSite: "strict",
    path: "/api",
  };

  response.clearCookie(SESSION_COOKIE_NAME, { ...sharedOptions, httpOnly: true });
  response.clearCookie(CSRF_COOKIE_NAME, { ...sharedOptions, httpOnly: false });
}

export const requireCsrf: RequestHandler = (request, response, next) => {
  const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = request.get("x-csrf-token");

  if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
    response.status(403).json({ error: "CSRF validation failed." });
    return;
  }

  next();
};

function tokensMatch(cookieToken: string, headerToken: string): boolean {
  const cookieBytes = Buffer.from(cookieToken, "utf8");
  const headerBytes = Buffer.from(headerToken, "utf8");
  return cookieBytes.length === headerBytes.length && timingSafeEqual(cookieBytes, headerBytes);
}