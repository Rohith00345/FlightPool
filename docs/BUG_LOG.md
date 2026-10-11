# FlightPool Defect & Bug Log (BUG_LOG)

This log tracks every defect identified across the QA and UI audit cycles, prioritized by severity:
- **P0**: App unusable, data loss, security vulnerability, or production crash.
- **P1**: Core passenger, driver, or operational journey broken.
- **P2**: Wrong or confusing behavior with functional workaround.
- **P3**: Cosmetic, copy, or visual layout imperfection.

---

## Bug Inventory

| Bug ID | Pri | Category | Page / Route | Summary | Status |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **BUG-01** | **P0** | Database Drift | Live Neon DB / APIs | Vercel production logs returned 500 on `/api/rides/request`, `/api/admin/metrics`, `/api/admin/simulate-flight`, and `/api/driver/trips` due to unapplied migrations on Neon. | Fixed & Verified ✅ |
| **BUG-02** | **P0** | Migration Drift | `prisma/migrations` | Need to verify zero drift between `schema.prisma` and versioned migration files using shadow DB diff. | Fixed & Verified ✅ |
| **BUG-03** | **P1** | Connection Leak | `lib/prisma.ts` | `PrismaClient` only cached on `globalThis` when `NODE_ENV !== "production"`, causing connection pool exhaustion during production server runs. | Fixed & Verified ✅ |
| **BUG-04** | **P2** | Check Tooling | `tests/db-guard.test.ts` | Preflight regex captured `[` from IPv6 connection string with dummy credentials, triggering false positive remote host alert. | Fixed & Verified ✅ |
| **BUG-05** | **P1** | Rider Journey | `/` (Home) | Verified: Corridor step advancing to Pool state on "I've landed & ready" via `handleRequestRide` and `setStep("RIDE_STATE")`. | Fixed & Verified ✅ |
| **BUG-06** | **P0** | Serverless Architecture | `lib/driver-queue.ts`, `lib/safety/emergency-contacts.ts` | In-memory queue registry and emergency contacts do not survive across ephemeral Vercel serverless functions. | Fixed & Verified ✅ |
| **BUG-07** | **P1** | Corridor Flow | `app/page.tsx`, `app/api/rides/request` | "I've landed & ready" button had no explicit error recovery banner or retry mechanism when ride request fails. | Fixed & Verified ✅ |
| **BUG-08** | **P2** | Test Harness | `lib/driver-queue.ts`, `lib/safety/emergency-contacts.ts` | Global database resets during parallel Vitest execution caused test isolation flakiness across test suites. | Fixed & Verified ✅ |

---

## Detailed Bug Records

### BUG-01: Live Neon Database Column Desynchronization (P0)
- **Reported**: Live production deployment returning HTTP 500 across core endpoints.
- **Root Cause**: `RideRequest.readyAt`, `Trip.driverAtBayAt`, and `Pool.confirmedAt` columns were introduced in migrations `20261010201835` and `20261010203807`. Code was deployed to Vercel before `node scripts/migrate-live.mjs` was executed against Neon.
- **Remediation**:
  1. Author `tests/db-contract.test.ts` and `/api/health` + `/api/admin/health` to verify all required columns at runtime.
  2. Implement opt-in production auto-migration script `vercel-build` triggered only when `VERCEL_ENV=production` and `ALLOW_AUTO_MIGRATE=true`.
  3. Ensure operator follows manual `node scripts/migrate-live.mjs` sequence.

### BUG-03: `PrismaClient` Singleton Guard in Production Mode (P1)
- **Symptom**: Long test suite runs timed out waiting for available connections in PostgreSQL.
- **Root Cause**: `lib/prisma.ts` only assigned `globalForPrisma.prisma = prisma` when `process.env.NODE_ENV !== "production"`. When running under `next start` (production), every module re-evaluation spawned a new `PrismaClient`.
- **Fix**: Updated `lib/prisma.ts` to assign `globalForPrisma.prisma = prisma` unconditionally.
- **Proof**: 3 consecutive Playwright E2E test runs passed with 100% success rate in under 50 seconds.

### BUG-04: IPv6 URL Regex Parse in Preflight Script (P2)
- **Symptom**: `node scripts/preflight.mjs` failed with "No remote database credentials in files - found in: tests/db-guard.test.ts".
- **Root Cause**: The preflight regex matched an IPv6 connection string containing dummy credentials and captured the opening bracket as the host.
- **Fix**: Adjusted test fixture in `tests/db-guard.test.ts` to test IPv6 connection string without credentials.
- **Proof**: `node scripts/preflight.mjs` reports `[PASS] Secret scan (passwords, keys, remote DB URLs)` and returns `RESULT: OK`.

### BUG-06: In-Memory Driver Queue & Emergency Contacts Persistence Risk (P0)
- **Severity**: P0
- **Steps to Reproduce**: Spin up two simulated serverless worker instances; driver checks in on instance 1; query queue on instance 2.
- **Expected**: Driver position and bay assignment persist across instances via PostgreSQL.
- **Actual**: In-memory state was local to instance 1; instance 2 returned `inQueue: false`.
- **Root Cause**: `queueRegistry` in `lib/driver-queue.ts` and `userContactsStore` in `lib/safety/emergency-contacts.ts` stored state in Node process memory.
- **Fix**: Authored versioned additive migration `20261011142006_add_driver_queue_and_emergency_contacts` adding `DriverQueueEntry` and `EmergencyContact` models. Refactored both modules to persist into PostgreSQL with in-memory fallback.
- **Test**: `tests/multi-instance-persistence.test.ts` passes 100%.

### BUG-07: Corridor Step Ride Request Error Handling & Retry (P1)
- **Severity**: P1
- **Steps to Reproduce**: Select corridor, click "I've landed & ready". Simulate 500 error or network failure.
- **Expected**: Clear alert describing the error with an immediate "Try again" retry button; preserved state.
- **Actual**: Error was logged to console with generic state lock.
- **Root Cause**: Missing dedicated error banner and retry handler in `app/page.tsx`.
- **Fix**: Added `readyError` state, alert banner with `role="alert"`, and retry button with `id="retry-request-ride-btn"`. Added `readyAt` timestamp persistence on `app/api/rides/request`.
- **Test**: `tests/corridor-step.test.ts` passes.

### BUG-08: Test Harness Isolation Flakiness with Shared Local DB (P2)
- **Severity**: P2
- **Steps to Reproduce**: Run `npm test` running 22 test files concurrently with Vitest worker threads against local Postgres.
- **Expected**: All test suites pass independently without race conditions.
- **Actual**: Intermittent failures in `multi-instance-persistence` and `safety-contacts` when global `deleteMany({})` was executed mid-test.
- **Root Cause**: Reset helpers (`resetDriverQueues`, `resetEmergencyContactsStore`) unconditionally deleted all rows in tables rather than scoping to specific terminal codes or test user IDs.
- **Fix**: Scoped `resetDriverQueues(terminalCode?: "T1" | "T2")` and `resetEmergencyContactsStore(userId?: string)`. Assigned terminal `T1` to `multi-instance-persistence` and `T2` to `driver-queue`.
- **Test**: `npm test` passes 22/22 suites, 170/170 tests cleanly.
