import dotenv from "dotenv";
import { assertLocalDatabase } from "../lib/db-guard";

dotenv.config();

const operation = process.argv[2] || "Destructive operation";

try {
  assertLocalDatabase(operation);
  console.log(`[DB Guard] Verified target DATABASE_URL is local for: ${operation}`);
  process.exit(0);
} catch (error: unknown) {
  console.error((error as Error).message);
  process.exit(1);
}
