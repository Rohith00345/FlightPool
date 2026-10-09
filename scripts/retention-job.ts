import { runRetentionJob } from "../lib/retention";
import { prisma } from "../lib/prisma";

runRetentionJob()
  .catch((err) => {
    console.error("Retention job failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
