# FlightPool Night Runway: Demonstration Walkthrough Script

## Executive Overview
This script provides an end-to-end guided walkthrough of **FlightPool (Night Runway)** for stakeholders, testing leads, and presentation reviews.

- **URL**: `http://localhost:3000`
- **Environment**: Demo mode enabled (`DEMO_MODE=true`, `NEXT_PUBLIC_DEMO_MODE=true`).
- **Theme**: Night Runway (Dark-first cockpit ambiance).

---

## 🎭 Persona 1: Aarav Sharma (Business Traveler to Thane)
*Scenario: Aarav lands on flight 6E-204 from Delhi at BOM Terminal 2 and wants to share a premium cab to Thane to avoid Mumbai airport traffic surge pricing.*

1. **Pre-Login Onboarding & Fare Radar**:
   - Open `http://localhost:3000`.
   - Point out the hero headline: *"Landing at BOM? Share a cab home and save up to 50%"*.
   - Point out the upfront fare radar visible **before signing in** (Guaranteed ₹360 vs ₹740 solo).
2. **One-Tap Demo Authentication**:
   - In the "Passenger Verification" card, click the **"Aarav Sharma"** quick persona button.
   - Click **"CONTINUE TO FLIGHT"** (`#login-btn`).
3. **Flight Picker & Arrivals Board**:
   - View the BOM flight list with the headline: *"3 passengers waiting"* and corridor chips (*"2 to Thane, 1 to Powai"*).
   - Click **"CONFIRM FLIGHT 6E-204"**.
4. **Digital Boarding Pass Hero**:
   - Inspect the aviation-style digital boarding pass hero card with origin `DEL` &rarr; destination `BOM`.
   - Click **"VERIFY & CONTINUE"**.
5. **Route Corridor & Wait-vs-Save Slider**:
   - Select **Thane** from the corridor grid.
   - Interact with the **Wait-vs-Save slider**: drag from left to right to demonstrate live rupee savings scaling up to 52% with haptic vibrations.
   - Click **"I'VE LANDED & READY"**.
6. **Pool Radar & Baggage Wait Trivia**:
   - Watch the pulsing radar formation animation scanning co-passengers.
   - Scroll down to the **Gate Trivia** card: answer the BOM terminal question for +25 Green Miles while waiting for luggage.
7. **Active Pool & Cab Bay P4**:
   - Pool forms with verified co-riders (showing "Trusted Rider" badge).
   - Click **"CONFIRM & LOCK SHARE"** and authorize via mock payment.
   - View the assigned cab at Bay P4 with OTP code, vehicle license plate, and drop-off sequence.
8. **Landing Celebration**:
   - Advance the trip to view the arrival celebration with carbon savings and rate driver.

---

## 🌸 Persona 2: Priya Nair (Women-Only Pool to Powai)
*Scenario: Priya arrives late at night at Terminal 2 and prefers to travel strictly with verified female co-passengers.*

1. Open `http://localhost:3000` and select **"Priya Nair"** demo persona.
2. Observe the **"Women-Only Pool"** toggle activated with the explicit privacy note: *"Gender verified via airline boarding pass. Never disclosed publicly."*
3. Progress through booking to observe that all matched co-passengers are verified female travelers.
4. Point out the calm **Safety Shield** (`#global-sos-btn`) in the navigation bar providing 24/7 Mumbai Police tracking and live family sharing without causing panic.

---

## 🛬 Act 3: BOM Landing Wave Board (`/landing-wave`)
1. Click **"Waves"** in the top navigation or navigate to `/landing-wave`.
2. Inspect the split-flap style arrivals board showing live incoming flights.
3. Toggle between **"All Terminals"**, **"Terminal T2"**, and **"Terminal T1"** to demonstrate instant corridor breakdowns.

---

## 🏆 Act 4: FlightDeck Game Layer (Rewards Tab)
1. On the home page, tap the **"Rewards"** tab in the mobile bottom navigation (or view on desktop).
2. Showcase the **Flight Score Gauge** (0–1000):
   - Review the 5 categories: Reliability (30%), Community (25%), Safety (20%), Loyalty (15%), Profile (10%).
   - Review the "Recent Score Audit" explaining score changes deterministically.
3. Review Tiers (Taxi &rarr; Supersonic) and Aviation XP Ranks (Ground Crew &rarr; Ace).
4. Review the **Opt-in Weekly Green Miles Leaderboard** celebrating carbon reduction.

---

## 🚕 Act 5: Driver Portal (`/driver`)
1. Navigate to `/driver`.
2. Review the **Driver Earnings Card**:
   - Gross fares, 15% platform fee, and net 85% driver payout.
   - Double-entry ledger pending confirmation status.
3. Review the **6-Box OTP Verification** for rider boarding at Bay P4.
4. Step through trip actions: *"En Route to Terminal Bay"* &rarr; *"Start Trip"* &rarr; *"Complete Drop-offs"*.

---

## 🛂 Act 6: Marshal Ground Station (`/marshal`)
1. Navigate to `/marshal`.
2. Inspect the **Designated Pickup Bays (Bay A – D)** at Terminal 2 Sahar.
3. Verify passenger boarding and trigger the **"Dispatch Bay"** action.

---

## 📊 Act 7: Admin Bento Fleet Dashboard (`/admin`)
1. Navigate to `/admin`.
2. Inspect the **Bento Box KPIs**: Match Rate (95%), Fill Rate, Avg Wait Time (capped at 20m), Captured Revenue (completed trips only).
3. Press **`Ctrl+K`** (or `Cmd+K`) to open the **Command Palette**:
   - Search for commands, refresh fleet KPIs, or trigger simulation.
4. Use the **"Land Flight & Match Pools"** simulator panel to simulate an incoming flight replay and view real-time pool clustering.
