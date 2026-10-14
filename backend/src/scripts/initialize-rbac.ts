import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { initializeSuperAdminRbac } from "../auth/rbac-initialization.js";
import { PrismaRbacInitializationRepository } from "../auth/prisma-rbac-initialization-repository.js";

dotenv.config({ path: resolve(process.cwd(), "../.env") });

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await initializeSuperAdminRbac(new PrismaRbacInitializationRepository(prisma));
    console.info("Super Admin role and permissions are initialized.");
  } catch {
    console.error("RBAC initialization failed. Check database availability and configuration.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();