# FlightPool Architectural Decisions & Trade-Offs (ADR)

This document outlines key technical decisions, trade-offs, and architectural justifications for **FlightPool**, a mobile-first PWA for Mumbai Airport (BOM) cab sharing and fare splitting.

---

## 1. Database & Persistence: SQLite (via Prisma ORM) for Local Dev
- **Decision**: Used SQLite via Prisma with a relational schema and seed dataset of 15 flights, 5 drivers/vehicles, and 42 passengers across 6 Mumbai destination corridors.
- **Trade-off**: While Postgres is the target production database, requiring a local running Docker or managed Postgres instance creates unnecessary friction for local reviewers and unit test automation.
- **Rationale**: Prisma's data abstraction layer makes switching between SQLite and Postgres a single line in `schema.prisma` (`provider = "postgresql"`). SQLite operates with zero setup, creates a portable `.db` file, and supports transactions and cascade deletes.

---

## 2. Matching Engine as a Pure Functional Core
- **Decision**: Implemented `/lib/matching/index.ts` as a pure, side-effect-free module independent of Next.js, HTTP, or Prisma.
- **Trade-off**: The database layer must map Prisma models to plain domain objects before invoking the engine, rather than letting the engine perform inline database queries.
- **Rationale**: 
  - Complete testability: 16 comprehensive unit tests run in sub-second execution (10ms) without spinning up mocks or DB connections.
  - Reusability: The simulation CLI (`scripts/simulate.ts`) and API routes (`/api/pools/match` and `/api/admin/simulate-flight`) invoke the exact same matching logic.
  - Predictability: Guaranteed determinism across edge cases (luggage overflows, detour limits, women-only filters, mid-pool cancellations).

---

## 3. Optimal Drop-off Permutations (TSP) vs External Routing Engines
- **Decision**: Implemented an exact permutation route optimizer ($k!$ permutations for $k \le 4$ stops, maximum 24 evaluations) using Haversine geodesic distance multiplied by Mumbai's road circuity factor (1.32x) and speed-traffic models.
- **Trade-off**: Does not fetch turn-by-turn road geometry from paid services (Google Maps Distance Matrix or Mapbox).
- **Rationale**: 
  - Zero API keys or paid dependencies required.
  - Instant calculation speed (< 1ms vs ~300ms network round-trip per pair).
  - For airport routes in Mumbai (e.g., T2 down Eastern Express Highway through Mulund to Thane, or Western Express Highway to Bandra/Andheri), the order of drop-offs along the highway corridor is geographically strictly ordered by radial distance.

---

## 4. Upfront Pricing Engine & Guaranteed 30% Savings
- **Decision**: Solo fare calculated as `baseFare (₹120) + perKmRate (₹18) * distance * timeMultiplier`. Pool fare provides a guaranteed minimum 30% savings vs solo fare (scaling to 45%-52% for 3 and 4 riders). Individual shares are rounded to nearest integer rupee and guaranteed to sum *exactly* to the total pool fare.
- **Trade-off**: If fares are rounded independently, rounding drift (±₹1) can occur. We implemented an exact-sum distribution pass to ensure zero rounding leak.
- **Rationale**: Riders at airport terminals demand upfront price transparency before boarding with strangers. Knowing they are saving at least ₹200–₹380 creates the primary conversion incentive.

---

## 5. Mock Razorpay Flow Behind `PaymentProvider` Interface
- **Decision**: Designed an extensible `PaymentProvider` interface with a `MockRazorpayProvider` implementation.
- **Lifecycle**:
  - `authorize`: Triggered when rider confirms pool share. Hold funds with an idempotency key.
  - `capture`: Triggered by driver when completing the final drop-off.
  - `refund`: Instant automatic release if a rider leaves the pool or if a pool collapses.
- **Rationale**: Decoupling the business logic from Razorpay SDK allows trivial swap for live Razorpay keys in production without modifying ride state machines.

---

## 6. Safety & Trust Architecture
- **Decision**:
  - **Exact Address Masking**: Co-riders only see the destination zone (e.g., "Thane West") until the pool is confirmed; exact street addresses remain masked.
  - **Strict Women-Only Filter**: Requests with the `womenOnly` toggle are matched strictly with other verified female passengers.
  - **Penalty-Free Leave**: Riders can cancel/leave a forming pool without penalty before the driver is dispatched.
  - **Emergency SOS**: Prominent one-tap SOS that immediately generates an `Incident` record and renders emergency dialers for Mumbai Police (112), BOM Airport Security Control Room (+91-22-66851010), and Women Helpline (1091).

---

## 7. Polling vs Server-Sent Events / WebSockets
- **Decision**: Used 5-second polling on `/api/rides/status` combined with optimistic UI updates.
- **Trade-off**: Modest periodic HTTP traffic during active ride search vs persistent socket connection.
- **Rationale**: Airport terminal mobile connections frequently drop and hand over between cellular towers and airport Wi-Fi. Stateless HTTP polling is vastly more fault-tolerant against intermittent disconnects than stateful WebSocket connections.
