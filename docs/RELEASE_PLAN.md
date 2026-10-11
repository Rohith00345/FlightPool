# FlightPool Production Release Plan (`release-2026-10-11`)

**Release Date**: 2026-10-11  
**Author**: Principal Release Engineer, QA Lead & Staff Full-Stack Engineer  
**Live Site Target**: `https://flight-pool-red.vercel.app`  
**Baseline Live Stable Tag**: `live-stable-2026-10-11` (Commit: `8f7fd4a`)  

---

## 1. Branch Inventory & Line-of-Work Evaluation

### A. Repository Branch Audit
| Branch | Commit | Relationship to `main` | Notes |
| :--- | :--- | :--- | :--- |
| `main` | `8f7fd4a` | HEAD | Live production baseline. Contains Night Runway premium UI, WCAG AA tokens, DB contract tests, and preflight tooling. |
| `phase-2-pre-landing` | `626fdb8` | Ahead by 6, Behind by 0 | **Chosen Primary Line of Work.** Linear extension of `main`. Contains Pre-landing queue, SMS/Cashfree adapters, Promo discounts, Demand radar, Feature flags, GST Invoicing, Driver Virtual Queue, and Emergency Safety Guard. |
| `fix-live-neon-qa` | `8f7fd4a` | Identical (0/0) | Exact duplicate of `main`. |
| `finish-upgrade` | `bca4dd8` | Behind by 24 | Historical ancestor of `main`. |
| `production-upgrade`| `34daeda` | Behind by 27 | Historical ancestor of `main`. |
| `fix-admin-metrics` | `349e939` | Behind by 27 | Historical ancestor of `main`. |
| `ui-premium` | `0726f0b` | Ahead by 1, Behind by 12 | Older branch; its UI improvements were already integrated into `main`. |
| `mega-upgrade` | `d2415dc` | Ahead by 2, Behind by 14 | Developer tooling branch; its scripts were already integrated into `main`. |

### B. Chosen Line of Work & Justification
`phase-2-pre-landing` is selected as the foundation for the release branch.  
**Justification**:
- It was created directly from `main` (`8f7fd4a`).
- It preserves all previous work on `main`: Night Runway theme (`#070A12`), responsive mobile layout, zero external fonts/hosts, fail-closed demo mode, and database column contract tests.
- It includes all 6 scale phases (Phases 2.0 to 2.8) with full test coverage (20 unit test suites / 166 passing tests).
- Clean merge without branch divergence.

---

## 2. Integration Strategy & Order

1. **Branch Creation**: Create `release-2026-10-11` from `main` (`8f7fd4a`).
2. **Merge `phase-2-pre-landing`**: Clean fast-forward / merge commit incorporating:
   - `bb1a3cf`: In-flight pre-landing booking queue (`QUEUED_IN_FLIGHT`).
   - `d578c0e`: Pluggable SMS gateways, Cashfree multi-gateway adapter, rewards endpoints.
   - `99bf191`: Promo coupon engine, referral profile, demand forecast radar.
   - `5a8a7a1`: Feature flags, deterministic hashing, admin remote config.
   - `b92b902`: GST tax breakdown, anti-IDOR invoice generation, rider trip history.
   - `626fdb8`: Driver virtual FIFO queue, geofence staging, emergency trusted contacts safety guard.
3. **Resolve Phase R3 Persistence & Safety Requirements**:
   - Ensure driver queue and emergency contacts persist in PostgreSQL with additive schema migrations (eliminating serverless in-memory loss).
   - Enforce contact consent, opt-out, rate limits, and tokenized trip sharing.
   - Fix corridor step transition (`"I've landed & ready"` moving to Pool step).
   - Enforce wait-cap consent, exact integer paise arithmetic, and 0 console errors.

---

## 3. Database Migrations & Safety Review Plan

1. **Existing Migrations in Main**:
   - `20261010023800_init_postgresql`
   - `20261010035000_remove_default_otp_hash`
   - `20261010085205_add_farequote_share_tokens_driver_docs`
   - `20261010201835_add_auto_solo_and_bay_timestamp`
   - `20261010203807_add_confirmed_at_and_ready_at`
2. **Planned Additive Migration (Phase R2 / R3)**:
   - Persist driver virtual queue (`DriverQueueEntry`) and trusted emergency contacts (`EmergencyContact`) in PostgreSQL.
   - Additive-only verification: Only `CREATE TABLE`, `ADD COLUMN` (nullable or defaulted), `CREATE INDEX`. Strictly zero `DROP`, `ALTER TYPE`, or `RENAME`.
   - Verify zero drift using local shadow database.

---

## 4. Live Verification & Rollback Protocol

- **Target URL**: `https://flight-pool-red.vercel.app`
- **Backup**: Full pg_dump before any live migration step in Phase R6 (`backups/dump-<timestamp>.sql`).
- **Smoke Tests**: `SMOKE_BASE_URL=https://flight-pool-red.vercel.app SMOKE_ALLOW_WRITES=1 npm run test:smoke`
- **Automatic Rollback Trigger**: If live health check or smoke test fails, revert merge commit on `main`, push to trigger immediate Vercel redeploy, and leave backward-compatible additive migrations in place.
