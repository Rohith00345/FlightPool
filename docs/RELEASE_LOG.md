# FlightPool Release Decisions & Action Log (RELEASE_LOG)

This log records every architectural decision, operational change, and justification for test modifications across all phases of the FlightPool release engineering workflow.

---

## Release Decisions

### Phase R0: Inventory & Baseline Tagging
- **Decision R0-1**: Tagged commit `8f7fd4a` on `main` as `live-stable-2026-10-11` and pushed to GitHub remote to serve as an immutable rollback target.
- **Decision R0-2**: Merged `phase-2-pre-landing` (containing the verified Night Runway theme, terminal staging geofence, and pre-landing schedule flows) as the primary base for the release line on `release-2026-10-11`.

### Phase R1: Integration
- **Decision R1-1**: Merged cleanly with `origin/phase-2-pre-landing` (commit `8b8e60f`), preserving all dark mode aesthetic tokens, airport terminal selector mechanics, and mock provider interfaces.
- **Decision R1-2**: Maintained fail-closed security for demo mode (`DEMO_MODE === "true"` strictly required).

### Phase R2: Database Integrity & Drift Elimination
- **Decision R2-1**: Identified schema drift in `schema.prisma` involving `DriverQueueEntry` and `EmergencyContact` models. Authored clean additive versioned migration `20261011142006_add_driver_queue_and_emergency_contacts`.
- **Decision R2-2**: Verified 0 drift between `prisma/migrations` and `prisma/schema.prisma` using local shadow database. Clean install on a brand-new empty local database verified with `prisma migrate deploy` and `prisma/seed.ts`.
- **Decision R2-3**: Implemented `/api/health` (public ping) and `/api/admin/health` (contract audit returning applied migration list and validating scalar model accessibility).
- **Decision R2-4**: Configured opt-in `vercel-build` script (`ALLOW_AUTO_MIGRATE === "true"` required on production Vercel builds).

### Phase R3: Serverless Persistence & Review Risks
- **Decision R3-1**: Migrated driver virtual queue and emergency contact registry from ephemeral process memory to PostgreSQL with transparent in-memory fallback.
- **Decision R3-2**: Added consent lifecycle to emergency contacts (`PENDING_CONSENT`, `CONSENTED`, `OPTED_OUT`), hourly rate limits (5 per user, 3 per phone recipient), DPDP data deletion in `/api/user/delete-data`, and mock SMS disclosure `[FlightPool MOCK SMS]`.
- **Decision R3-3**: Resolved corridor transition on "I've landed & ready" by adding persistent `readyAt` timestamp in `/api/rides/request` and adding retry recovery UI state (`readyError`, `#retry-request-ride-btn`).
- **Decision R3-4**: Refactored test harness reset helpers (`resetDriverQueues`, `resetEmergencyContactsStore`) to accept scoped arguments (terminal code, user ID) preventing cross-suite race conditions in parallel Vitest runs.

---

## Test Line Modifications & Justifications (Rule 0.2 Audit)

As required by Rule 0.2 ("Never weaken, skip or delete a test, lint rule or script. Explain every edited or deleted test line in docs/RELEASE_LOG.md"):

1. **`tests/payments.test.ts` (Line deleted vs main)**:
   - *Line removed*: `import { verifyRazorpayWebhookSignature } from "../lib/payments/provider";`
   - *Reason*: Unused import cleanup. The webhook signature validation tests in `tests/e2e/security-rbac.spec.ts` and `tests/payments.test.ts` execute direct cryptographic payload validation via `verifyPaymentSignature`. No test assertions or test coverage were weakened or removed.

2. **`tests/driver-queue.test.ts` (Test Driver Fixture & Terminal Scoping)**:
   - *Edit*: Changed `testDriver.phone` from `+919876543210` to `+919876549999` and added `beforeAll` / `afterAll` database synchronization for `testDriver`.
   - *Reason*: `+919876543210` collided with seed data `driver_1`, triggering a unique constraint error on `Driver.phone`. The change provides a dedicated isolated fixture without altering any queue behavior assertions.
   - *Edit*: Changed `resetDriverQueues()` to `resetDriverQueues("T2")`.
   - *Reason*: Scopes queue cleanup to terminal T2, preventing Vitest parallel worker thread collision with multi-instance tests running on T1.

3. **`tests/multi-instance-persistence.test.ts` (Terminal T1 Assignment)**:
   - *Edit*: Changed test terminal from `T2` to `T1` (`AIRPORT_GEOFENCES.T1`).
   - *Reason*: Vitest executes test files in parallel across CPU cores against the single local database. Assigning T1 to multi-instance tests and T2 to driver-queue tests prevents concurrent worker interference while verifying the exact same FIFO queue invariants across instances.

4. **`tests/safety-contacts.test.ts` (Scoped User Reset)**:
   - *Edit*: Updated `beforeEach` to call `resetEmergencyContactsStore` for test user IDs (`usr_safety_test`, `usr_night_rider`, `usr_day_rider`, `usr_api_rider`) rather than clearing the global table.
   - *Reason*: Prevents test worker threads running `safety-contacts.test.ts` from clearing rows created by concurrent `multi-instance-persistence.test.ts` tests.
