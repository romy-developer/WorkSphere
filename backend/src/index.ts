import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { AuthService } from "./auth/service.js";
import { SessionTokenService } from "./auth/token.js";
import { PrismaAuthRepository } from "./auth/prisma-repository.js";

dotenv.config({ path: resolve(process.cwd(), "../.env") });

const prisma = new PrismaClient();
const authService = new AuthService(
  new PrismaAuthRepository(prisma),
  new SessionTokenService(process.env.AUTH_TOKEN_SECRET ?? ""),
);
const app = createApp({
  authService,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  secureCookies: process.env.NODE_ENV === "production",
});

const port = Number(process.env.API_PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`WorkSphere API listening on http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}