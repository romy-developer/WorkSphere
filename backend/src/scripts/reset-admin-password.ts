import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { resolve } from "node:path";
import {
  AdminPasswordResetInputError,
  AdminPasswordResetRoleError,
  AdminPasswordResetUserNotFoundError,
  resetSuperAdminPassword,
} from "../auth/admin-password-reset.js";
import { PrismaAdminPasswordResetRepository } from "../auth/prisma-admin-password-reset-repository.js";

dotenv.config({ path: resolve(process.cwd(), "../.env") });

async function main(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the environment.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    await resetSuperAdminPassword(
      { email, password },
      new PrismaAdminPasswordResetRepository(prisma),
      argon2,
    );
    console.info("Updated the Super Admin password.");
  } catch (error) {
    if (
      error instanceof AdminPasswordResetInputError ||
      error instanceof AdminPasswordResetRoleError ||
      error instanceof AdminPasswordResetUserNotFoundError
    ) {
      console.error(error.message);
    } else {
      console.error("Password reset failed. Check database availability and retry.");
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();