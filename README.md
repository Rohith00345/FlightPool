# ✈️ FlightPool (Night Runway)

> **Mobile-first PWA for Mumbai Airport (BOM) passengers to share cabs, split fares to destination corridors, and reduce airport congestion.**

[![Branch: mega-upgrade](https://img.shields.io/badge/Branch-mega--upgrade-amber)](https://github.com/Rohith00345/FlightPool)
[![Vitest: 66/66](https://img.shields.io/badge/Vitest-66%2F66%20Passed-green?logo=vitest)](https://github.com/Rohith00345/FlightPool)
[![Playwright E2E: 43/43](https://img.shields.io/badge/Playwright-43%2F43%20Passed-blue?logo=playwright)](https://github.com/Rohith00345/FlightPool)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.0%20(Turbopack)-black?logo=next.js)](https://nextjs.org/)
[![Accessibility: WCAG AA](https://img.shields.io/badge/Axe--core-WCAG%20AA%200%20Violations-emerald)](https://github.com/Rohith00345/FlightPool)

---

## 🌟 What's New in the Mega-Upgrade (Night Runway)

1. 🌌 **Night Runway Design System**:
   - Dark-first cockpit flight-deck ambiance with glowing amber (`#FFB020`), teal (`#2DE2C4`), and violet (`#7C6CFF`) tokens.
   - Built with Next.js managed typography (`Space Grotesk`, `Inter`, `JetBrains Mono`, `Noto Sans Devanagari`).
   - Three theme modes: **Night Runway** (Dark Default), **Daylight Terminal** (Light), and **AMOLED Black**.
   - Built-in tactile haptics (`navigator.vibrate`) and reduced-motion support.
2. 🛬 **Landing Wave Arrivals Board (`/landing-wave`)**:
   - Split-flap arrivals schedule showing incoming flights to BOM Terminal 1 & 2 with active pooling corridors.
3. 🎮 **FlightDeck Gamification Layer (`/` Rewards Tab)**:
   - Flight Score (0–1000) across 5 weighted categories (Reliability 30%, Community 25%, Safety 20%, Loyalty 15%, Profile 10%).
   - Tiers (Taxi, Takeoff, Cruise, Jet Stream, Supersonic) and Ranks (Ground Crew to Ace).
   - Miles store, season quests with streak freeze, passport stamps, and opt-in Green Miles leaderboard.
   - Fail-closed demo gating: Active mock gamification in demo mode; tasteful "Rewards coming soon" in production.
4. 🛡️ **Enterprise Security & DPDP Compliance**:
   - Strict RBAC across all 28 API routes (`docs/ROUTE_ACCESS_TABLE.md`).
   - Constant-time HMAC signatures for webhooks and session tokens.
   - Bounded wait-cap evaluation with explicit user consent before solo conversion.
   - Strict integer paise money standard (`docs/MONEY_UNITS.md`).
5. 📊 **Admin Bento Fleet Dashboard (`/admin`)**:
   - 6 essential fleet KPIs including wait time formula (`confirmedAt - readyAt`) and fill rate with/without solo.
   - Command Palette (`Ctrl+K` / `Cmd+K`) for rapid airport operations control.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client [Client PWA Interfaces]
        RiderUI["Rider Interface (/) - 4-Tab Bottom Nav"]
        WaveUI["Landing Wave Board (/landing-wave)"]
        DriverUI["Driver Portal (/driver) - Earnings & Route Steps"]
        MarshalUI["Marshal Station (/marshal) - Bay A-D Ops"]
        AdminUI["Admin Bento Dashboard (/admin) - Ctrl+K Palette"]
    end

    subgraph CoreEngines [Pure Domain Logic]
        MatchEngine["Matching Engine (/lib/matching)\n- Corridor grouping\n- Detour cap (<=20m)\n- Women-only filtering"]
        PriceEngine["Pricing Engine (/lib/pricing)\n- Integer paise standard\n- >=30% savings\n- 85% Driver / 15% Platform"]
        GameEngine["Gamification Provider (/lib/gamification)\n- Flight Score (0-1000)\n- Tiers & Quests\n- Gate Trivia"]
    end

    subgraph BackendAPI [Protected REST API Routes]
        AuthAPI["/api/auth/otp"]
        RidesAPI["/api/rides/request & status"]
        PoolsAPI["/api/pools/match, confirm, leave, solo"]
        TripsAPI["/api/trips/[id], stream, sos, rate"]
        MarshalAPI["/api/marshal/station"]
        AdminAPI["/api/admin/metrics, simulate-flight"]
    end

    subgraph DataLedger [Storage & Double-Entry Ledger]
        Postgres[(Docker PostgreSQL - localhost:5433)]
        Ledger["Double-Entry Ledger\n- RIDER_WALLET -> REVENUE / PAYOUT\n- Unconfirmed payouts stay PENDING"]
    end

    RiderUI --> BackendAPI
    WaveUI --> BackendAPI
    DriverUI --> BackendAPI
    MarshalUI --> BackendAPI
    AdminUI --> BackendAPI
    BackendAPI --> CoreEngines
    BackendAPI --> DataLedger
```

---

## 🚀 Local Development Quickstart

### Prerequisites
- Node.js 20 LTS
- Local Docker running PostgreSQL on `localhost:5433` (`flightpool-postgres`)

### 1. Verification & Preflight
```bash
npm run check       # Runs preflight environment & database safety check
npm run verify      # Runs complete TypeScript, ESLint, and Vitest test suites
```

### 2. Run Test Suites
```bash
npm test            # Runs 66 unit & integration tests
npx playwright test # Runs complete e2e browser test suite
```

### 3. Run Development Server
```bash
npm run dev         # Starts Next.js with Turbopack on http://localhost:3000
```
