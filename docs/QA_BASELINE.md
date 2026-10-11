# FlightPool QA Baseline Report (Phase QA-0)

**Date**: 2026-10-11T07:32:00Z  
**Branch**: `fix-live-neon-qa`  
**Base Commit**: `1adfc77`  
**Target Database**: Local Docker PostgreSQL 16 + PostGIS 3.4 (`localhost:5433`)  

---

## 1. System & Environment Versions

| Component | Version | Status |
| :--- | :--- | :---: |
| **Node.js** | `v20.18.0` | ✅ Verified (>= 18) |
| **npm** | `10.8.2` | ✅ Verified |
| **Next.js** | `16.4.0` (Turbopack) | ✅ Verified |
| **Prisma Engine / CLI** | `6.19.3` | ✅ Verified |
| **Docker Engine & PostGIS** | `postgis/postgis:16-3.4` (healthy on 5433) | ✅ Verified |
| **Operating System** | Windows 10 (win32 x64) | ✅ Verified |

---

## 2. Database Clean Initialization (`npm run db:reset` & `db:seed:demo`)

Executed from scratch against local PostgreSQL on port 5433 with [scripts/db-guard.ts](file:///c:/Users/Rohith%20Nambaru/.gemini/antigravity-ide/scratch/flightpool/scripts/db-guard.ts) safety enforcement:
- **Prisma Migrations Applied (5)**:
  1. `20261010023800_init_postgresql`
  2. `20261010035000_remove_default_otp_hash`
  3. `20261010085205_add_farequote_share_tokens_driver_docs`
  4. `20261010201835_add_auto_solo_and_bay_timestamp`
  5. `20261010203807_add_confirmed_at_and_ready_at`
- **Seeding Execution**:
  - 15 BOM Reference Flights created.
  - 42 Passengers and boarding pass verifications seeded across 6 Mumbai destination corridors.
  - 5 Vehicles and 5 Drivers created with active demonstration pools in Thane and Bandra (women-only).

---

## 3. Static Verification & Unit Suite Baseline

| Check | Command | Result | Duration | Notes |
| :--- | :--- | :---: | :---: | :--- |
| **ESLint** | `npm run lint` | ✅ PASS | 7.8s | 0 errors, 4 unused-variable warnings in test files. |
| **TypeScript Typecheck** | `npx tsc --noEmit` | ✅ PASS | 6.8s | 0 type errors across all routes, pages, and components. |
| **Vitest Unit & Integration Suite** | `npm test` | ✅ PASS | 1.07s | **66 / 66 tests passing** across 10 test files. |
| **Production Build** | `npm run build` | ✅ PASS | 8.8s | Turbopack compilation succeeded for all 38 routes. |

---

## 4. End-to-End Suite 3-Run Stability Matrix (`npm run test:e2e`)

The Playwright test suite was executed **3 consecutive times** against local production servers (`http://localhost:3000` demo mode, `http://localhost:3001` production mode):

| Test Suite File | Tests | Run 1 | Run 2 | Run 3 | Pass Rate | Flakiness |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `tests/e2e/flightpool.spec.ts` | 5 | 5/5 | 5/5 | 5/5 | **100%** | 0% |
| `tests/e2e/production-fail-closed.spec.ts` | 6 | 6/6 | 6/6 | 6/6 | **100%** | 0% |
| `tests/e2e/security-rbac.spec.ts` | 26 | 26/26 | 26/26 | 26/26 | **100%** | 0% |
| `tests/e2e/ui-quality.spec.ts` | 6 | 6/6 | 6/6 | 6/6 | **100%** | 0% |
| **Total** | **43** | **43/43** (49.5s) | **43/43** (49.2s) | **43/43** (49.5s) | **100%** | **0%** |

---

## 5. Summary of Baseline Observations

1. **Prisma Connection Pooling**: Resolved initial timeout risk by making `PrismaClient` a strict global singleton in `lib/prisma.ts`.
2. **Deterministic Stability**: Zero flaky tests observed across 129 test executions (3 runs x 43 tests).
3. **Database Guard Integrity**: Destructive scripts (`db:reset`, seed) remain strictly blocked against non-localhost databases.
