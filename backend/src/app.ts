import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import type { AuthService } from "./auth/service.js";
import { createAuthRouter } from "./routes/auth.js";
import { createProtectedRouter } from "./routes/protected.js";

interface AppOptions {
  authService: AuthService;
  frontendOrigin: string;
  secureCookies: boolean;
}

export function createApp({ authService, frontendOrigin, secureCookies }: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: frontendOrigin,
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRouter({ authService, secureCookies }));
  app.use("/api", createProtectedRouter(authService));
  app.use((_request, response) => {
    response.status(404).json({ error: "Not found." });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const requestErrorStatus = getErrorStatus(error);
    const requestErrorType = getErrorType(error);
    if (requestErrorStatus === 413) {
      response.status(413).json({ error: "Request is too large." });
      return;
    }
    if (requestErrorStatus === 400 || requestErrorType === "entity.parse.failed") {
      response.status(400).json({ error: "Invalid request." });
      return;
    }

    response.status(500).json({ error: "Internal server error." });
  };
  app.use(errorHandler);

  return app;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function getErrorType(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) return undefined;
  return typeof error.type === "string" ? error.type : undefined;
}