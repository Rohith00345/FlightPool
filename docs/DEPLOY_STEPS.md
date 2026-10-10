# FlightPool Deployment Guide & Release Runbook

## 1. Migration Inventory
The following Prisma migrations were authored during this upgrade cycle. Each migration is strictly versioned in `prisma/migrations/`:

| Migration Directory | Key Schema Changes & Effects |
| :--- | :--- |
| `20261010182600_add_fare_quote_and_audit_fields` | Adds `FareQuote` table for upfront fare locks, `DriverPayout` table with `status = PENDING` by default, double-entry `LedgerAccount` & `LedgerEntry` foreign keys, and DPDP `AuditLog` fields. |
| `20261010203807_add_confirmed_at_and_ready_at` | Adds `confirmedAt DateTime?` on `Pool` and `readyAt DateTime?` on `RideRequest` to allow accurate, capped average wait time calculations (`confirmedAt - readyAt`) ignoring stale seed records. |

---

## 2. Environment Variables Matrix

| Variable | Description | Preview | Production | Sensitive |
| :--- | :--- | :---: | :---: | :---: |
| `DATABASE_URL` | PostgreSQL connection string (Neon pooler in live; Docker local in dev) | Required | Required | Yes |
| `SESSION_SECRET` | HMAC SHA-256 signing secret for session tokens (&ge; 32 chars) | Required | Required | Yes |
| `CRON_SECRET` | Bearer token authenticating Vercel cron triggers on `/api/cron/*` | Required | Required | Yes |
| `DEMO_MODE` | Server-side flag (`"true"` enables simulation & dev OTP; `""` in prod) | Optional | Set to `""` | No |
| `NEXT_PUBLIC_DEMO_MODE` | Client-side flag controlling UI demo personas & rewards | Optional | Set to `""` | No |
| `ADMIN_PHONES` | Comma-separated E.164 phone numbers granted ADMIN role | Required | Required | Yes |
| `RAZORPAY_KEY_ID` | Payment gateway API key identifier | Optional | Required | Yes |
| `RAZORPAY_KEY_SECRET` | Payment gateway webhook verification secret | Optional | Required | Yes |
| `FAST2SMS_API_KEY` | Real OTP SMS delivery gateway key | Optional | Required | Yes |

---

## 3. Vercel Plan & Cron Configuration Note
- **Vercel Hobby Plan Compatibility**: Vercel Hobby accounts enforce daily-or-slower execution limits on `vercel.json` cron expressions.
- **Configured Schedules in `vercel.json`**:
  - `0 4 * * *` (Daily at 04:00 UTC): `/api/cron/retention` (purges expired DPDP data & OTPs).
  - `0 3 * * *` (Daily at 03:00 UTC): `/api/cron/wait-cap` (sweeps stale open pools).
- **Primary Mechanism**: In-flight requests rely primarily on **lazy on-read expiry evaluation** (`processWaitCapExpiries(poolId)`) invoked when users poll `/api/rides/status`. Background cron acts as a safety-net sweep.

---

## 4. Exact Execution Order (Production Rollout)
*Follow this exact sequence. Do NOT merge to `main` until Steps 1 and 2 are complete.*

1. **Step 1: Execute Database Migrations against Neon**
   - Open a **NEW Command Prompt** window (do not reuse the development window).
   - `cd` into the FlightPool repository folder.
   - Set the direct Neon database connection string:
     ```cmd
     set "DATABASE_URL=your direct Neon string"
     ```
   - Run the live migration script:
     ```cmd
     node scripts\migrate-live.mjs
     ```
   - When prompted, type `MIGRATE LIVE` to confirm deployment.
   - Once migrations complete, close the Command Prompt window.

2. **Step 2: Add / Verify Vercel Environment Variables**
   - Go to Vercel Dashboard &rarr; Project &rarr; **Settings** &rarr; **Environment Variables**.
   - Verify every variable in Section 2 is configured. If Preview variables are missing, tick **Preview** for each variable in Vercel settings.
   - Ensure `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_PHONES`, and `DATABASE_URL` are present for both Preview and Production.
   - Keep `DEMO_MODE` empty or `"false"` in Production.

3. **Step 3: Merge to `main` on GitHub**
   - Open GitHub &rarr; Create a Pull Request from `mega-upgrade` into `main`.
   - Verify CI checks pass, then **Merge Pull Request**.
   - Vercel will trigger the live production deployment automatically.

4. **Rollback Plan (Emergency Contingency)**:
   - If the live site breaks after deployment:
   - Go to Vercel Dashboard &rarr; **Deployments**.
   - Locate the last known good deployment.
   - Click the three dots (`...`) &rarr; **Promote to Production**.

---

## 5. Blueprint: Tables & APIs to Make Game Layer Real
When transitioning from the mock `GamificationProvider` to live production persistence, the following additions will be deployed:

### Database Tables (`prisma/schema.prisma`)
1. `xp_events`: `(id, userId, xp, reason, tripId, createdAt)`
2. `badges`: `(id, code, title, description, icon, category)`
3. `user_badges`: `(id, userId, badgeId, unlockedAt)`
4. `quests`: `(id, title, description, type, target, rewardMiles, season)`
5. `user_quests`: `(id, userId, questId, progress, isCompleted, streakFreezeUsed)`
6. `reward_catalog`: `(id, title, costMiles, discountRupees, terms, active)`
7. `redemptions`: `(id, userId, catalogId, code, isUsed, redeemedAt)`
8. `score_events`: `(id, userId, delta, category, reason, createdAt)`
9. `streaks`: `(id, userId, currentStreak, freezeTokens, lastActiveAt)`

### REST Endpoints
1. `GET /api/rewards/score`: Returns real-time score breakdown across 5 categories.
2. `GET /api/rewards/catalog`: Lists active ride vouchers.
3. `POST /api/rewards/redeem`: Consumes miles for an upfront ride credit.
4. `GET /api/rewards/quests`: Fetches current season milestones and streak freeze status.
5. `GET /api/rewards/leaderboard`: Returns opt-in weekly Green Miles community ranking.
