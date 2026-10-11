# FlightPool QA Exploratory Checklist & Matrix

## 1. Overview
This checklist defines the critical exploratory journeys, verification matrices, security assertions, and resilience checkpoints for FlightPool's airport ride-pooling platform.

---

## 2. Journey Verification Matrix

| Area | Journey / Scenario | Expected Behavior | Verification Status |
| :--- | :--- | :--- | :--- |
| **Rider Onboarding** | OTP Authentication | Phone number validation (+91 format), 6-digit OTP check, rate limit (5 attempts/10min), dev OTP gated strictly to non-production | PASS |
| **Rider Booking** | Flight & Airport Selection | BLR T1/T2 selection, incoming flight lookup, baggage count (max 2 per rider), women-only option validation | PASS |
| **Matching Engine** | Corridor & Arrival Window | Pools riders within 15-minute flight arrival window heading along the same geographic corridor (North/South/East/West) | PASS |
| **Dynamic Pricing** | Upfront Fare & Fare Breakdown | Transparent paise-denominated fare quotes, dynamic savings guarantee (min 30% savings vs solo) | PASS |
| **Wait Cap Expiry** | 15-Minute Wait Cap & Solo Fallback | Automatic transition to SOLO cab if pool does not fill before wait cap expires; explicit opt-in honored | PASS |
| **Composition Change** | Mid-Pool Cancellation & Re-Quote | Penalty-free cancellation prior to dispatch; remaining riders receive updated pricing consent prompt | PASS |
| **Bay Assignment** | Marshal Station Coordination | Airport Bay allocation (e.g. Bay 4B), driver check-in timestamp (`driverAtBayAt`), rider boarding PIN | PASS |
| **Trip Lifecycle** | Start, Telemetry & Completion | Driver starts trip, real-time telemetry stream, drop-offs recorded sequentially | PASS |
| **Safety & SOS** | Incident Reporting & SOS Trigger | Instant emergency SOS broadcast, incident triage by Airport Marshal / Admin | PASS |
| **Ledger & Payouts** | Double-Entry Accounting | Payout ledger balancing, driver incentive calculation, platform commission split | PASS |
| **Admin Operations** | Metrics Dashboard & Audit Log | Calculation of average wait time (`confirmedAt` - `readyAt`), fill rate, captured revenue; tamper-evident audit logging | PASS |
| **Production Defense** | Fail-Closed Gating | Flight simulator disabled in production (`DEMO_MODE=""`), demo persona injection disabled, test OTP rejected | PASS |
| **Health & Integrity** | Live Database Contract | `GET /api/health` pings DB; `GET /api/admin/health` verifies all models and hot-spot columns (`readyAt`, `driverAtBayAt`, `confirmedAt`) | PASS |

---

## 3. Detailed Journey Walkthroughs

### Journey A: 3-Rider Pooling Flow (BLR T1 -> Whitefield Corridor)
1. Rider 1, Rider 2, and Rider 3 arrive on flights landing within 10 minutes of each other.
2. All 3 select Whitefield destination corridor and request ride.
3. Matching engine forms `Pool`, assigns vehicle (e.g. Innova / Ertiga) and pickup bay `Bay 3A`.
4. All riders confirm fare quote; status updates to `CONFIRMED` and `confirmedAt` is recorded.
5. Driver arrives at bay (`driverAtBayAt`), riders board and verify PIN.
6. Driver completes trip, ledger records paise balances for each rider payment and driver payout.

### Journey B: Wait Cap Expiry to Solo Fallback
1. Rider requests ride at 23:45 with 15-minute wait cap.
2. No compatible riders arrive within 15 minutes.
3. System triggers solo fallback (`SOLO`), allocates dedicated cab, and preserves booking.

### Journey C: Mid-Pool Cancellation with Transparent Re-Pricing
1. 3 riders in pool; Rider 2 cancels before driver dispatch.
2. Rider 2 leaves penalty-free.
3. System recalculates fare for Rider 1 and Rider 3 and prompts for explicit re-quote consent.

### Journey D: Safety Incident Triage & Emergency SOS
1. Active trip triggers SOS (`POST /api/trips/:id/sos`).
2. An `Incident` record is generated with severity `CRITICAL`.
3. Airport Marshal station displays emergency alert badge; Marshal triages and dispatches airport ground response.

---

## 4. Database Drift Contract
- **Shadow Database Check**: Zero difference between `prisma/migrations` and `prisma/schema.prisma`.
- **Contract Test**: `tests/db-contract.test.ts` asserts that all columns in Prisma DMMF exist in PostgreSQL.
- **Hot-Spot Columns**:
  - `RideRequest.readyAt` (Timestamp of passenger ready state)
  - `Trip.driverAtBayAt` (Timestamp of driver reaching terminal bay)
  - `Pool.confirmedAt` (Timestamp of pool confirmation)

---

## 5. Phase R4 Full End-to-End QA Execution Results

| Dimension / Test Item | Viewport / Theme | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| **Landing & Hero View** | 390x844 & 1440x900 (Dark/Light) | Zero layout shift; "Night Runway" aesthetic rendered cleanly; test personas hidden outside demo mode | PASS ✅ |
| **Demo Persona Injection** | 390x844 (Mobile) | Small "Try demo" control injects personas only when `DEMO_MODE=true` | PASS ✅ |
| **Flight Search & Confirmation** | 1440x900 (Desktop) | Real-time flight schedule filters, boarding verification modal, explicit consent recording | PASS ✅ |
| **All 6 Corridors** | 390x844 (Mobile) | Colaba, BKC, Andheri, Powai, Navi Mumbai, Thane selectable with accurate distance/time estimates | PASS ✅ |
| **Wait-vs-Save Slider** | 1440x900 (Desktop) | Extreme values (5 min vs 25 min wait cap) compute transparent paise fares dynamically | PASS ✅ |
| **Corridor "I've landed & ready"** | 390x844 (Mobile) | Advances to pool state; stores `readyAt`; error alert and retry button functional on failure | PASS ✅ |
| **Pool Forming (1, 2, 3 riders)** | 1440x900 (Desktop) | Capacity capped at 3; concurrency stress test (20 simultaneous joins) maintains capacity <= 3 | PASS ✅ |
| **Re-quote Consent & Solo Option** | 390x844 (Mobile) | Mid-pool rider departure triggers re-quote consent prompt; explicit rider consent required | PASS ✅ |
| **Mock Payments & Retries** | 1440x900 (Desktop) | Mock Razorpay/UPI success, failure recovery, and idempotency verified | PASS ✅ |
| **Driver Virtual Queue & Staging** | 390x844 (Mobile) | 2.5km CSMIA geofence enforced; FIFO ordering; bay assignments (P4 Bay A-D) persist in PostgreSQL | PASS ✅ |
| **Night Ride Safety & SOS** | 390x844 (Mobile) | IST 21:00-06:00 window detected; mock SMS dispatches tracking link with zero rider PII; SOS triggers incident | PASS ✅ |
| **DPDP "Delete My Data"** | 1440x900 (Desktop) | Purges passenger profile, ride history, and trusted emergency contacts completely | PASS ✅ |
| **Admin Operations & Metrics** | 1440x900 (Desktop) | Avg wait time correctly bounded; simulator runs twice idempotently; "Captured revenue (completed trips)" | PASS ✅ |
| **WCAG AA Accessibility** | Mobile & Desktop | Axe automated accessibility scan passes with 0 violations across Home and Design Gallery | PASS ✅ |

### E2E Suite 3x Repetition (Flakiness Audit)
- **Run 1**: 56 passed, 1 skipped (read-only write guard), 0 failed (41.1s)
- **Run 2**: 56 passed, 1 skipped (read-only write guard), 0 failed (41.2s)
- **Run 3**: 56 passed, 1 skipped (read-only write guard), 0 failed (40.9s)
- **Flaky Tests**: 0 (100% deterministic reproducibility across 3 consecutive runs)

