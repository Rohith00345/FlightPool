# FlightPool Production Upgrade: Phase Log

This log tracks every phase of the production upgrade on the `production-upgrade` branch.
All existing unit and E2E tests must remain green. Changes, touched files, test results, and risks are documented per phase.

---

## Baseline Test Results (Pre-Phase 0)

| Tool | Status | Summary / Details |
| :--- | :--- | :--- |
| **ESLint (`npm run lint`)** | ⚠️ 51 Problems | 21 errors, 30 warnings. Errors include React Compiler purity checks (`Math.random` in callback, `setState` in effect), `@typescript-eslint/no-explicit-any`, and `@typescript-eslint/no-require-imports` in `lib/prisma.ts`. |
| **TypeScript (`npx tsc --noEmit`)** | ✅ Passed | 0 type errors. |
| **Vitest (`npm test`)** | ✅ Passed | 25/25 passing (9 pricing tests, 16 matching tests) in 355ms. |
| **Playwright (`npm run test:e2e`)** | ✅ Passed | 5/5 passing (Main Journey, Solo Fallback, Mid-pool Cancel, Women-only Pool, 360px Viewport) in 7.1s. |

---

## Phase 0: Audit & Architecture Review

- **Status**: Completed
- **Branch**: `production-upgrade`
- **Files Touched**:
  - `/docs/AUDIT.md` (created)
  - `/docs/PHASE_LOG.md` (created)
- **Summary**: Comprehensive audit of existing architecture, database models, API routes, security posture, and feature gap analysis against `/docs/production-features-and-architecture.md` and `/docs/schema.sql`.
- **Baseline Verification**: All 25 unit tests and 5 Playwright E2E tests verified green.
- **Risks Identified**:
  1. Ephemeral SQLite storage on Vercel serverless.
  2. Missing authentication & role-based authorization on `/admin`, `/driver`, and sensitive APIs.
  3. Dev OTP (`123456`) accepting any phone number.
  4. Floating point currency storage instead of integer paise.
  5. In-memory / client-driven timers for wait cap and pool expiry rather than server-side scheduler jobs.
- **Next Step**: User installing WSL2 (`wsl --install`) and restarting computer to enable Docker Desktop Linux backend for local PostgreSQL on port 5433.

---

## Phase 1: Persistence (Local Docker PostgreSQL Setup)

- **Status**: Completed ✅
- **Branch**: `production-upgrade`
- **Files Modified**:
  - `docker-compose.yml`: Added `postgis/postgis:16-3.4` service on port 5433 with healthcheck and named volume `flightpool_postgres_data`.
  - `.env.example`: Added `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT=5433`, and `DATABASE_URL`.
  - `.env`: Configured `DATABASE_URL="postgresql://flightpool:flightpool_dev_pass@localhost:5433/flightpool?schema=public"`.
  - `prisma/schema.prisma`: Switched `datasource db` provider from `sqlite` to `postgresql`.
  - `package.json`: Added `db:up`, `db:down`, `db:reset`, `db:migrate`, `db:seed`.
  - `lib/prisma.ts`: Removed `/tmp` SQLite fallback for Vercel.
  - `next.config.ts`: Cleaned up `outputFileTracingIncludes` for `dev.db`.
- **Database Verification**:
  - Docker container `flightpool-postgres` running healthy (`postgis/postgis:16-3.4` on port 5433).
  - PostGIS 3.4 and PostgreSQL 16.4 verified active.
  - Tables generated via `prisma db push` and verified on PostgreSQL schema `public`.
  - Database seeded successfully (`npx prisma db seed` -> 43 users, 15 flights, 5 drivers, 5 vehicles, 2 active pools).
- **Test Results**:
  - Vitest: 25/25 tests passing (351ms).
  - Playwright E2E: 5/5 tests passing (7.9s).
  - TypeScript (`tsc --noEmit`): 0 errors.

---

## Phase 2: Data Foundation & Schema Expansion (schema.sql alignment)

- **Status**: Completed ✅
- **Branch**: `production-upgrade`
- **Files Touched**:
  - `prisma/schema.prisma`: Added 12 production models (`Airport`, `Terminal`, `PickupBay`, `Zone`, `PricingRule`, `Consent`, `AuditLog`, `SosEvent`, `LedgerAccount`, `LedgerEntry`, `Payout`, `DriverIncentive`). Added `version` (optimistic locking) and `corridor` to `Pool`.
  - `prisma/seed.ts`: Added seeding for Mumbai Airport (BOM), Terminals (T1, T2), 6 pickup bays, 6 destination zones across 3 corridors, default pricing rules with integer paise (12000 paise base, 1800 paise/km), and platform double-entry ledger accounts.
  - `app/api/admin/metrics/route.ts`: Converted static average wait time metric into dynamic database calculation querying passenger request ready times.
- **Verification**:
  - PostgreSQL schema pushed and synced with 25 tables in public schema.
  - Seed executed successfully with all relation constraints verified.
  - Vitest: 25/25 passing (327ms).
  - Playwright E2E: 5/5 passing (6.6s).
  - TypeScript (`tsc --noEmit`): 0 errors.

---

## Phase 3: Auth, RBAC, Security & Compliance (Phase B)

- **Status**: Ready to Implement
- **Objectives**:
  1. Server-Side RBAC & Route Protection:
     - Enforce role gates on `/admin` and `/api/admin/*` (ADMIN role only).
     - Enforce role gates on `/driver` and `/api/driver/*` (DRIVER role only).
     - Guard anonymous access with redirects or 403 Forbidden.
  2. Phone OTP Authentication Hardening:
     - Support `DEMO_MODE=true` for local reviewers / E2E tests (`123456` dev OTP allowed when `DEMO_MODE !== 'false'`).
     - In-memory / DB rate limiting for OTP generation and verification attempts (max 5 attempts, 10 min window).
     - Set secure HTTP-only session cookies / signed auth tokens for user identification.
  3. Audit Logging:
     - Persist `AuditLog` records on admin simulator actions (`/api/admin/simulate-flight`) and administrative modifications.
  4. Privacy & Consent Compliance:
     - Consent logging in `consents` table when submitting boarding pass data or requesting rides.
     - Add privacy disclosure and "Delete My Data" endpoint (`/api/user/delete-data`).



