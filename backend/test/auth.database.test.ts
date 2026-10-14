import dotenv from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { AuthService, InvalidCredentialsError } from "../src/auth/service.js";
import { PrismaAuthRepository } from "../src/auth/prisma-repository.js";
import { SessionTokenService } from "../src/auth/token.js";
import { getIsolatedTestDatabaseUrl } from "./database-test-config.js";

dotenv.config({ path: resolve(process.cwd(), "../.env") });

const databaseTestsEnabled = process.env.RUN_DATABASE_AUTH_TESTS === "1";
const databaseDescribe = databaseTestsEnabled ? describe : describe.skip;
const testDatabaseUrl = databaseTestsEnabled
  ? getIsolatedTestDatabaseUrl(
      process.env.WORKSPHERE_TEST_DATABASE_URL,
      process.env.DATABASE_URL,
      process.env.NODE_ENV,
    )
  : undefined;

databaseDescribe("Prisma-backed authentication (opt-in, read-only)", () => {
  let prisma: PrismaClient | undefined;
  let authService: AuthService | undefined;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error("Isolated test database configuration is required.");
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const [connection] = await prisma.$queryRaw`SELECT current_database() AS database_name`;
    expect(connection.database_name).toBe("worksphere_test");
    authService = new AuthService(
      new PrismaAuthRepository(prisma),
      new SessionTokenService(randomBytes(32).toString("hex")),
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("uses PostgreSQL for a missing-user lookup and returns the generic login error", async () => {
    if (!authService) throw new Error("Authentication test service was not initialized.");
    const email = `missing-${randomUUID()}@example.invalid`;

    await expect(authService.login(email, randomBytes(24).toString("base64url")))
      .rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});