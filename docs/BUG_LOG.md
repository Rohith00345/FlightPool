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
