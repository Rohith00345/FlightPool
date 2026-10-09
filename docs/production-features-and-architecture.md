# FlightPool: Production-Ready Features, Databases and Architecture

Companion file: `schema.sql` (full PostgreSQL + PostGIS schema, ~45 tables).
Priorities: **P0** = launch blocker, **P1** = needed for a credible pilot, **P2** = scale features, **P3** = polish/moat.
Tags: **[Uber]** **[Ola]** **[Rapido]** mean the feature is a standard pattern in ride-hailing apps; verify exact current behaviour in each app before copying. Items marked (verify) need legal, pricing or availability checks.

---

## 1. Can FlightPool plug into Uber, Ola or Rapido?

| Option | What it means | Verdict |
|---|---|---|
| **A. Borrow their feature patterns** | Rebuild proven ride-hailing features in FlightPool | **Do this.** Sections 2-3 |
| **B. Hand-off for the solo fallback** | If nobody matches, deep-link the rider to an existing cab app | Possible via public deep links (verify what each app currently supports); low effort, but it sends your rider and revenue elsewhere |
| **C. Fleet-partner supply** | Contract licensed fleets/drivers who also drive on those platforms | **Recommended for supply.** You own the pooled trip and the rider relationship |
| **D. Their booking APIs** | Book rides programmatically on their platforms | Generally not openly available for third-party pooling in India (verify); do not base the product on it |
| **E. Get an aggregator licence** | Operate as a licensed aggregator under state rules | Needed if you dispatch your own drivers at scale (verify under the 2025 Motor Vehicle Aggregator Guidelines and Maharashtra rules) |

**Recommendation:** C now, E when volume justifies it, and B only as a last-resort fallback.

---

## 2. Full Feature Catalogue

### 2.1 Rider app

| Pri | Feature | Notes |
|---|---|---|
| P0 | Phone OTP login, session management, device binding | Rate limits; no dev OTP in production |
| P0 | Flight + boarding-pass verification | Hash PNR only; one pass cannot be reused by two accounts |
| P0 | Upfront fare quote: solo vs pool price, saving, wait estimate, quote expiry **[Uber][Ola]** | Stored in `fare_quotes` |
| P0 | Pool lifecycle UI with live state and co-rider first names + verified badge | Pool state machine |
| P0 | Wait cap and solo fallback | Never strand a rider |
| P0 | Pickup guidance: terminal, numbered bay, walking directions, vehicle plate, driver photo **[Uber][Ola]** | |
| P1 | Live trip tracking with ETA and drop-off order | Driver location stream |
| P1 | Share trip link **[Uber][Ola]** | Read-only, expiring token |
| P1 | In-app SOS with live location and ops callback **[Uber][Ola][Rapido]** | |
| P1 | Payments: UPI, cards, wallet; auto-refund when pool collapses | |
| P1 | Receipts and GST invoices by email/PDF **[Uber][Ola]** | (verify GST treatment) |
| P1 | Ratings and tags for driver and co-riders **[Uber][Ola][Rapido]** | |
| P1 | Cancellation with clear fee rules and no penalty before driver assignment | |
| P1 | Push, SMS and WhatsApp notifications | Pool formed, driver assigned, delay |
| P2 | Saved places, trip history, re-book last route **[Uber][Ola][Rapido]** | |
| P2 | Scheduled/pre-booked pool linked to the flight (auto-activates on landing) | Core differentiator |
| P2 | Promo codes, referrals, wallet credits **[Uber][Ola][Rapido]** | |
| P2 | Women-only pools with ID verification; trusted-contact auto-share for night rides | |
| P2 | In-app support chat and help centre **[Uber][Ola]** | |
| P2 | Language toggle: English, Hindi, Marathi | Replace double-labelled screens |
| P3 | Corporate profiles and expense reports **[Uber][Ola]** | |
| P3 | Accessibility: screen-reader labels, large text, wheelchair-accessible vehicle option | |
| P3 | Rider tier / loyalty perks | |

### 2.2 Driver app

| Pri | Feature | Notes |
|---|---|---|
| P0 | Driver onboarding: KYC, licence, RC, permit, insurance, police verification, photo | `driver_documents` with expiry alerts |
| P0 | Online/offline, trip offer with accept/decline timer **[Uber][Ola][Rapido]** | |
| P0 | Ordered multi-stop route, pickup/drop buttons, rider no-show handling | |
| P1 | Turn-by-turn navigation hand-off to maps apps | |
| P1 | Earnings dashboard, per-trip breakdown, weekly payouts **[Uber][Ola][Rapido]** | `payouts`, `driver_incentives` |
| P1 | Earnings guarantee and airport queue-free pickups | Addresses the driver-economics risk |
| P1 | Airport geofence and virtual queue (no physical queue) | |
| P2 | Demand heat-map and peak-wave alerts **[Uber][Rapido]** | |
| P2 | Fatigue limits and mandatory rest prompt | |
| P2 | Document expiry reminders and auto-suspend | |
| P3 | Driver ratings insights and training modules | |

### 2.3 Matching and dispatch engine

| Pri | Feature | Notes |
|---|---|---|
| P0 | Wave-based batching (30-45 min window), corridor zones, capacity and luggage fit | |
| P0 | Detour cap and drop-off ordering | |
| P0 | Re-pricing and consent when a rider leaves | |
| P1 | Driver assignment by distance/ETA, rating, acceptance rate, with re-dispatch within 3 min | **[Uber][Ola]** |
| P1 | Flight delay/cancel handling that shifts windows using live flight data | |
| P2 | Predictive pre-matching from historical flight x time x destination demand | Data flywheel |
| P2 | Pool merge/split optimisation and vehicle upsizing | |
| P3 | Fixed-price vs dynamic pricing experiments | Fixed price is part of the promise; test carefully |

### 2.4 Pricing, payments and finance

| Pri | Feature | Notes |
|---|---|---|
| P0 | Versioned pricing rules (`pricing_rules`) and exact fare splitting that sums to the total | |
| P0 | Idempotent payments (`idempotency_key`), authorise on confirm, capture on completion | |
| P1 | Double-entry ledger, nightly reconciliation, GST handling (verify) | `ledger_*` tables |
| P1 | Driver payouts and commission statements | |
| P1 | Refund workflows (pool collapse, flight cancel, driver no-show, dispute) | |
| P2 | Fraud rules for promo abuse and chargebacks | |
| P2 | Corporate invoicing and credit lines | |

### 2.5 Trust, safety and compliance

| Pri | Feature | Notes |
|---|---|---|
| P0 | Role-based access control; admin, marshal and driver routes protected server-side | |
| P0 | Consent capture, privacy notice, data deletion (DPDP Act, verify with counsel) | `consents` |
| P0 | SOS creating incident records with severity S1-S4 and response targets | |
| P1 | Women-only pools with verified identity; last-drop rule at night | |
| P1 | Anti-fraud: GPS-spoof detection, duplicate boarding pass, device-farm detection, collusion between rider and driver | |
| P1 | Audit logs for all admin actions | `audit_logs` |
| P2 | Insurance integration and claim workflow | |
| P2 | Driver behaviour monitoring: harsh braking, route deviation alerts | |
| P3 | Safety scoring for riders and drivers | |

### 2.6 Ops and admin console

| Pri | Feature | Notes |
|---|---|---|
| P0 | KPIs computed from the database, not hard-coded | `kpi_daily` view |
| P1 | Live pool board, manual override (merge, split, reassign), flight simulation (demo only) | |
| P1 | Incident triage board and SOS response | |
| P1 | Marshal app: arrivals waves, bay status, manual verification | |
| P2 | Pricing and geofence configuration UI, feature flags, rollout percentages | `feature_flags` |
| P2 | Support ticketing and dispute management | |
| P2 | Driver/fleet management, document review queue | |
| P3 | A/B testing console and cohort dashboards | |

### 2.7 Integrations

| Need | Options (verify pricing, coverage and terms) |
|---|---|
| Flight status | AviationStack, FlightAware AeroAPI, Cirium, airline/airport feeds |
| Boarding-pass verification | Customer-submitted code + flight lookup first; airline/DigiYatra-style integration later |
| Maps, ETA, routing | Google Maps Platform, Mappls (MapMyIndia), or self-hosted OSRM + OpenStreetMap |
| Payments | Razorpay, Cashfree (UPI, cards, wallets, payouts) |
| SMS/WhatsApp | WhatsApp Business Cloud API, MSG91, Twilio |
| Push | Firebase Cloud Messaging, APNs |
| Analytics | PostHog (events, funnels, experiments), plus warehouse export |
| Errors and tracing | Sentry, OpenTelemetry |
| Identity checks | Government ID/selfie KYC vendor (verify DPDP and UIDAI rules) |

---

## 3. Databases and Data Stores

| Store | Used for | Suggested product for your Vercel stack |
|---|---|---|
| **PostgreSQL + PostGIS** (system of record) | Users, flights, requests, pools, trips, payments, ledger, incidents | Neon or Supabase Postgres (enable PostGIS) |
| **Redis** | Driver live positions (geo index), pool locks, OTP rate limits, short-lived quotes, pub/sub for live updates | Upstash Redis |
| **Job queue / scheduler** | Wait-cap expiry, flight polling, payouts, notifications, retention jobs | Inngest, Upstash QStash, BullMQ on Redis |
| **Object storage** | Driver documents, KYC images, invoices (private buckets, signed URLs) | S3, Cloudflare R2, Supabase Storage |
| **Analytics store** | Funnels, cohorts, experiments | PostHog; later BigQuery or ClickHouse |
| **Search (optional)** | Support and admin search | Postgres full-text first; Typesense later |

**Redis key design**

| Key | Value | TTL |
|---|---|---|
| `driver:geo:{airport}` | GEO set of online drivers | none (members expire via heartbeat) |
| `driver:hb:{driverId}` | last heartbeat | 30 s |
| `pool:lock:{poolId}` | join lock | 5 s |
| `quote:{requestId}` | current fare quote | 10 min |
| `otp:rate:{phone}` | OTP counter | 10 min |
| `wave:{airport}:{corridor}:{windowStart}` | set of ready request IDs | window length + 1 h |
| `share:{tokenHash}` | trip id | link expiry |

**Data rules:** money as integer paise; store only a hash of boarding-pass data; encrypt PII fields; partition `driver_locations` by month and purge raw points after a short retention window (for example 30 days, verify with counsel); enable Row-Level Security if you use Supabase; run daily encrypted backups with a tested restore.

---

## 4. Non-Functional Requirements

| Area | Target (A) |
|---|---|
| Availability | 99.9% for rider booking and SOS |
| Latency | Match computation p95 < 2 s; API p95 < 500 ms |
| Real-time updates | Rider sees pool change within 3 s (SSE/WebSocket) |
| Security | OWASP Top 10 review, secrets in a vault, dependency scanning, pen test before public launch |
| Privacy | Consent logs, retention policy, deletion within 30 days of request (verify) |
| Observability | Structured logs, traces, alerting on match-rate drop, payment failures, SOS latency |
| Delivery | CI with unit + Playwright E2E tests, staging environment, feature flags, rollbacks |
| Scale test | Simulate 500 concurrent riders in one landing wave |

---

## 5. Delivery Order

| Release | Contents |
|---|---|
| **R1 (Pilot-safe)** | All P0 items: auth/RBAC, verification, pool state machine, wait cap, quotes, mock-then-real payments, SOS incidents, DB-computed KPIs, consent |
| **R2 (Pilot-ready)** | P1: live tracking, share trip, ratings, ledger and payouts, notifications, driver earnings, marshal app, anti-fraud basics, flight delay handling |
| **R3 (Scale)** | P2: scheduled pools, promos/referrals, predictive matching, config console, support tooling, multi-airport |
| **R4 (Moat)** | P3: airline/OTA SDK, corporate, loyalty, experimentation platform |

---

## 6. Antigravity Prompt: Production Upgrade

```
ROLE: Staff engineer upgrading the existing FlightPool app (Next.js on Vercel) to production grade.

INPUTS: /docs/AUDIT.md (current state), schema.sql (target PostgreSQL + PostGIS schema), and the
feature catalogue in production-features-and-architecture.md. Do not rewrite working parts; migrate them.

PHASE A - Data foundation
- Set up Postgres with PostGIS (Neon or Supabase) and Redis (Upstash). Use a migration tool (Prisma Migrate
  or Drizzle Kit). Convert schema.sql into migrations; keep money as integer paise.
- Seed: Mumbai airport, T1/T2, bays, zones (Thane, Mulund, Powai, Bandra, Andheri, Navi Mumbai), flights,
  pricing rules, demo riders/drivers. Replace all hard-coded admin KPIs with queries on kpi_daily.

PHASE B - Auth, RBAC and compliance
- Phone OTP auth with rate limits and a DEMO_MODE flag; roles rider/driver/admin/marshal/support enforced on
  every API route and page server-side. Audit-log all admin actions.
- Consent capture for boarding-pass data, privacy notice, delete-my-data flow, retention jobs.

PHASE C - Core pool engine
- Verification, ride_requests, pools, pool_members with optimistic locking (pools.version) and Redis locks.
- Wave matching service (pure functions + tests): corridor, window, capacity, luggage, detour cap, women-only.
- Fare quote service: versioned pricing_rules, minimum saving guarantee, shares that sum exactly.
- Wait-cap scheduler: at wait_cap_at offer keep-waiting or solo fallback. Never strand a rider.
- Server-Sent Events for live pool and trip updates.

PHASE D - Payments and money
- PaymentProvider interface (mock + Razorpay/Cashfree in test mode): authorise, capture, refund, idempotency keys.
- Double-entry ledger writes in the same DB transaction as payment state changes; nightly reconciliation job;
  payout generation per driver per week.

PHASE E - Safety, driver and ops
- SOS to sos_events and incidents with S1-S4 workflow and admin triage board; share-trip links; ratings.
- Driver app: onboarding documents, online/offline, offer accept/decline timer, multi-stop route, earnings,
  guarantee top-ups, document-expiry alerts.
- Marshal view and admin console (live pools, overrides, flight delay simulation in DEMO_MODE only).
- Notification service interface (push/SMS/WhatsApp mocks) with templates.

PHASE F - Quality, analytics, hardening
- PostHog/analytics events for the full funnel written to analytics_events as well.
- Unit tests for matching and pricing (>= 30 cases); Playwright E2E for: 3-rider match and completion, wait cap
  to solo, mid-pool cancel with re-pricing, women-only pool, RBAC (anonymous cannot open /admin or /driver),
  SOS incident creation, payment idempotency.
- Sentry, structured logs, rate limiting, security headers, CSP, dependency scan, load test of 500 riders in one wave.
- Accessibility pass, PWA manifest, English/Hindi/Marathi toggle, README, DECISIONS.md, runbook for incidents.

RULES: Ask before adding paid services or API keys. Keep DEMO_MODE working. One commit per phase.
Flag anything you could not verify. Never store raw boarding-pass or card data.
```
