import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { resolve } from "node:path";
import {
  BootstrapConfigurationError,
  BootstrapEmailInUseError,
  BootstrapInputError,
  bootstrapSuperAdmin,
} from "../auth/bootstrap.js";
import { PrismaBootstrapRepository } from "../auth/prisma-bootstrap-repository.js";

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
    const result = await bootstrapSuperAdmin(
      { email, password },
      new PrismaBootstrapRepository(prisma),
      argon2,
    );

    if (result.status === "created") {
      console.info("Created the initial Super Admin account.");
    } else {
      console.info("A Super Admin already exists; no account or password was changed.");
    }
  } catch (error) {
    if (
      error instanceof BootstrapInputError ||
      error instanceof BootstrapEmailInUseError ||
      error instanceof BootstrapConfigurationError
    ) {
      console.error(error.message);
    } else {
      console.error("Bootstrap failed. Check database availability and retry.");
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();