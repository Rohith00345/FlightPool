// Applies migrations to the LIVE (Neon) database. It never resets or seeds.
// Usage (in a NEW Command Prompt window): set "DATABASE_URL=<your Neon direct URL>" then: node scripts/migrate-live.mjs
import readline from "node:readline/promises";
import { live, hostOf, isLocalHost } from "./_lib.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in this window. Run: set "DATABASE_URL=your-neon-url"  then try again.');
  process.exit(1);
}
const host = hostOf(url);
if (!host) {
  console.error("DATABASE_URL could not be read. Put the whole address in quotes in the set command.");
  process.exit(1);
}
if (isLocalHost(host)) {
  console.error("This is a local database. This script is only for the live database. Nothing was changed.");
  process.exit(1);
}
if (/-pooler\./.test(host)) {
  console.error("This looks like a pooled address. Use the DIRECT connection string (pooling switched off) for migrations.");
  process.exit(1);
}
console.log(`Target database host: ${host}`);
console.log("Step 1 of 2: read-only status check\n");
if (live("npx prisma migrate status") > 1) process.exit(1);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question('\nType MIGRATE LIVE to apply the pending migrations to this database (anything else cancels): ');
rl.close();
if (answer.trim() !== "MIGRATE LIVE") {
  console.log("Cancelled. Nothing was changed.");
  process.exit(0);
}
console.log("\nStep 2 of 2: applying migrations (deploy only, no reset)\n");
const code = live("npx prisma migrate deploy");
console.log(code === 0 ? "\nDone. Now close this window so the address is cleared from memory." : "\nMigration failed. Do not merge to main. Copy the error (without any password) and ask for help.");
process.exit(code);
