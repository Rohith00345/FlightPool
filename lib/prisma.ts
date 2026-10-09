import path from "path";
import { PrismaClient } from "@prisma/client";

// Ensure DATABASE_URL fallback exists in production/serverless (e.g. Vercel)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) {
  if (process.env.VERCEL) {
    const fs = require("fs");
    const tmpDbPath = path.join("/tmp", "dev.db");
    const sourceDbPath = path.join(process.cwd(), "prisma", "dev.db");
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(sourceDbPath)) {
      try {
        fs.copyFileSync(sourceDbPath, tmpDbPath);
      } catch (e) {
        console.error("Failed to copy dev.db to /tmp:", e);
      }
    }
    process.env.DATABASE_URL = `file:${tmpDbPath}`;
  } else if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
