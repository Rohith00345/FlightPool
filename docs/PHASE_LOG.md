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
  - `.env`: Configured `DATABASE_URL="postgresql://flightpool:YOUR_PASSWORD@localhost:5433/flightpool?schema=public"`.
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

## Phase 2: Data Foundation, Schema Expansion, Hardening & Security

- **Status**: Completed ✅
- **Branch**: `production-upgrade`
- **Files Touched**:
  - `prisma/schema.prisma`: Added 13 production models (`Airport`, `Terminal`, `PickupBay`, `Zone`, `PricingRule`, `Consent`, `AuditLog`, `SosEvent`, `LedgerAccount`, `LedgerEntry`, `Payout`, `DriverIncentive`, `OtpRequest`). Added `version` (optimistic locking), `corridor` to `Pool`, and `genderVerified` to `User`.
  - `prisma/migrations/20261010023800_init_postgresql/migration.sql`: Generated and committed versioned PostgreSQL migration replacing `prisma db push`.
  - `lib/auth.ts`: Implemented database-backed OTP rate limiter (`OtpRequest` table, max 5 unconsumed attempts per 10-minute window), HMAC-signed base64url session token system with prioritized Bearer token extraction, and `requireRole` RBAC helper.
  - `app/api/auth/otp/route.ts`: Database rate limiting integration, DEMO_MODE toggle verification, 3-way gender support (`PREFER_NOT_TO_SAY`), and `genderVerified` marking.
  - `app/api/admin/metrics/route.ts`: Protected endpoint restricted to `ADMIN` role.
  - `app/api/admin/simulate-flight/route.ts`: Protected endpoint restricted to `ADMIN` role and requires `DEMO_MODE=true`.
  - `app/api/admin/retention/route.ts` & `lib/retention.ts` & `scripts/retention-job.ts`: Automated data retention background job purging expired OTP requests (>24h), stale cancelled ride requests (>30d), and historical audit logs (>90d). Added npm script `"job:retention"`.
  - `app/api/driver/trips/route.ts`: Created dedicated driver portal trip endpoint requiring `DRIVER` role.
  - `app/api/rides/status/route.ts`, `app/api/rides/request/route.ts`, `app/api/pools/confirm/route.ts`, `app/api/pools/leave/route.ts`, `app/api/pools/solo/route.ts`, `app/api/trips/[id]/route.ts`: Audited and secured every rider and driver route with strict ownership checks (rider can only access their own records; driver only their assigned trips).
  - `app/api/rides/request/route.ts` & `app/page.tsx`: Strict verification step for women-only pools (`gender === "FEMALE"` and `genderVerified === true`).
  - `app/page.tsx`: Added 3-way gender toggle (`Male`, `Female 🌸`, `Prefer not to say`) and verified female status badge.
  - `app/admin/page.tsx` & `app/driver/page.tsx`: Quick persona sign-in conditioned strictly on `DEMO_MODE=true`.
  - `components/Navbar.tsx`: Hidden `/admin` and `/driver` internal staff navigation links from riders.
  - `app/layout.tsx`: Removed `maximumScale: 1` and `userScalable: false` for WCAG 2.1 AA accessibility compliance.
  - `next.config.ts`: Added full production security headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
  - `.gitignore`: Untracked `prisma/dev.db` and added `*.db` patterns.
  - `tests/e2e/security-rbac.spec.ts`: Expanded to 11 comprehensive tests verifying RBAC, cross-user access rejection (403), women-only restriction (400), OTP rate limiting (429), consent capture, and DPDP data purge.
- **Verification**:
  - Vitest Unit Tests: 25/25 passing (100%).
  - Playwright E2E Tests: 16/16 passing (100% across `flightpool.spec.ts` and `security-rbac.spec.ts`).
  - TypeScript (`tsc --noEmit`): 0 errors.
  - Next.js Production Build (`npm run build`): Completed with 0 errors.

---

## Phase 3: Pool Engine Reliability (Next Phase)

- **Status**: Ready to Implement 🚀
- **Scope (Aligned with Mega Prompt)**:
  1. **Optimistic Locking**:
     - Concurrency control on `pools.version` to prevent race conditions during rapid concurrent passenger joins (`UPDATE pools SET version = version + 1 WHERE id = $1 AND version = $2`).
  2. **Server-Side Wait-Cap and Expiry Jobs**:
     - Background evaluation of passenger wait caps (default 20 minutes) to transition unpooled riders to solo fallback or extend wait time.
  3. **Fare Quote Records (`FareQuote` model)**:
     - Persisted fare quotes ensuring guaranteed upfront fare calculations remain tamper-proof from quote to payment.
  4. **Server-Sent Events (SSE)**:
     - Real-time updates via `/api/pools/[id]/stream` and `/api/trips/[id]/stream` using standard HTTP text/event-stream for live radar and driver tracking.





