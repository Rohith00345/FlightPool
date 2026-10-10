# FlightPool: All-in-One Mega Prompt (with automatic checks)

You will not need to check branches, databases, secrets or tests by hand. Four small scripts do it for you:

| Command | What it does |
|---|---|
| `node scripts/preflight.mjs` | Fails if you are on main, if any database address is not local, if `.env` is tracked or in history, or if a password or key is found in files |
| `node scripts/verify.mjs` | Runs preflight, lint, type check, unit tests, build and end-to-end tests, checks test deletions and cron schedules, writes `docs/VERIFY_REPORT.md` |
| `node scripts/ship.mjs "message"` | Runs preflight and verify, refuses to touch main or env files, commits, and pushes the branch |
| `node scripts/migrate-live.mjs` | Applies migrations to the live Neon database only, with a typed confirmation, never resets or seeds |

## Setup (one time, about 2 minutes)

1. Download the five script files from this chat (`_lib.mjs`, `preflight.mjs`, `verify.mjs`, `ship.mjs`, `migrate-live.mjs`) and copy them into your FlightPool `scripts` folder.
2. Open Command Prompt and run:
```
cd /d "C:\Users\Rohith Nambaru\.gemini\antigravity-ide\scratch\flightpool"
git checkout finish-upgrade
node scripts\preflight.mjs
git add -A
git commit -m "Save finish-upgrade work and add check scripts"
git checkout -b mega-upgrade
node scripts\preflight.mjs
```
The last preflight must say `RESULT: OK` (a Docker warning is fine only if Docker Desktop is closed; open it before the agent starts).
3. Paste the prompt below into Antigravity.
4. When the agent finishes, run:
```
node scripts\verify.mjs
node scripts\ship.mjs "Mega upgrade: fixes, admin metrics, premium UI"
```

## The prompt

```
ROLE
You are a staff engineer, QA lead and product designer. Complete ALL parts below in order on the existing
FlightPool repo, on branch mega-upgrade. Extend what exists; do not rewrite working code. Follow AGENTS.md and /docs.

TOOLS YOU MUST USE (do not ask me to check things by hand)
- First action: create these package.json scripts if missing: "check": "node scripts/preflight.mjs",
  "verify": "node scripts/verify.mjs", "ship": "node scripts/ship.mjs", "migrate:live": "node scripts/migrate-live.mjs".
  The files in /scripts already exist; do not weaken them.
- Run `node scripts/preflight.mjs` before starting and `node scripts/verify.mjs` after finishing each part. Treat any
  FAIL as a stop: fix it (max 3 attempts), then re-run. Do not continue past a failing verify.

SAFETY RULES
- Branch mega-upgrade only. You may commit locally after each part passes verify, but NEVER push, merge or deploy.
  I will run the ship script myself. Never touch main.
- Use ONLY my local Docker Postgres (localhost). Never connect to any remote database. Never run reset, seed or
  deleteMany against anything but localhost (the db-guard must stay).
- Demo mode stays fail-closed (DEMO_MODE === "true" only). Never hard-code secrets. No PII or OTPs in logs.
- Never weaken, skip or delete an existing test or lint rule. Keep every existing id and data-testid.
- Do not add external hosts (fonts, tiles, scripts, images) without asking. Use next/font for fonts.
- Stop and ask ONLY if an account, key or legal decision is needed. Otherwise use a mock/provider interface.
- Say "could not verify" instead of guessing. Do not claim facts about other companies as certain.
- If any change needs a database migration, list it in docs/DEPLOY_STEPS.md (migration folder name and what it
  adds). Migrations are versioned files; never edit an old migration.

PART A - FIXES FROM THE LAST REVIEW
A1. vercel.json: use daily-or-slower schedules (compatible with the Vercel Hobby plan) unless I confirm Pro.
    On-read expiry is the primary mechanism. Document the choice in docs/DEPLOY_STEPS.md.
A2. Wait-cap consent: never auto-charge, auto-confirm or auto-convert to solo without rider consent. At the cap
    present: keep waiting (bounded), go solo at a clearly disclosed price, or cancel free. Auto-solo only if the
    rider opted in earlier. Add tests.
A3. On-read expiry safety: process only the caller's own pool/request, be idempotent (version or row lock) and
    rate-limited per pool. Test: 20 simultaneous status reads at expiry cause exactly one transition.
A4. One function that derives the journey state from RideRequest + Pool + Trip, with invariant tests for impossible
    combinations. Add a real "driver at bay" timestamp/state separate from "en route to pickup".
A5. Denial tests (anonymous 401, wrong role 403, cross-user 403) for /api/pools/match, /api/pools/solo,
    /api/trips/[id]/stream and /api/pools/[id]/consent-pricing. Restrict who may call match and rate-limit it.
    Save the full route table with real file:line references as docs/ROUTE_ACCESS_TABLE.md.
A6. Money units: one unit (integer paise) across pricing, quotes, pools, payments, ledger and UI. List every
    conversion point in docs/MONEY_UNITS.md and add tests that fail if rupees and paise are mixed.
A7. Load test: use real zones, coordinates and real pricing; explain the difference between the average solo fare
    in the test and the app's real solo fare (about Rs 740 to Thane). Re-run and label results as "local machine,
    local database only".
A8. Payout job: payouts stay PENDING until a PayoutProvider confirms; post the bank ledger entry only on
    confirmation. Tests.
A9. Make sure all work is committed on mega-upgrade (no staged-but-uncommitted files).

PART B - ADMIN DASHBOARD BUGS
B1. Avg Wait Time showed 345.2m with a 20m cap. Define wait = pool confirmedAt minus rideRequest readyAt for matched
    requests in the last 24 hours; ignore stale seed data; show "-" when there is no data. Unit tests with fixtures.
B2. Duplicate identical pools appeared. Find the cause (seed or simulator). Make simulate-flight idempotent per
    flight and prevent one driver being in two overlapping active pools. Tests.
B3. Label single-rider confirmed pools "Solo". Show fill rate with and without solo pools.
B4. Rename Platform Rev to "Captured revenue (completed trips)" and confirm how it is computed.
B5. Use "T1/T2" everywhere instead of "TT1/TT2".

PART C - PREMIUM UI, DARK MODE, GAME LAYER (UI only, no schema changes)
Rules for this part: no API contract, auth, payment or ledger changes. Gamification values come from a mock
GamificationProvider ONLY when demo mode is on; with demo mode off show a tasteful "Rewards coming soon" state.
Never show fake numbers as real.

Design direction "Night Runway": dark-first premium flight-deck feel with a boarding-pass motif.
Dark tokens: bg #070A12, surface #0E1424, surface-2 #141C30, text #EAF0FF, muted #8A94B2, primary amber #FFB020,
accent teal #2DE2C4, rewards violet #7C6CFF, success #3DDC97, danger #FF5C6C.
Light "Daylight Terminal": bg #F5F7FB, surface #FFFFFF, text #0B1020, primary #D98200, accent #00A88E.
Fonts via next/font: Space Grotesk (display), Inter (UI), JetBrains Mono (codes, prices), Noto Sans Devanagari
(Hindi/Marathi). Radius 16/24, subtle glows, glass sheets used sparingly, spring motion (~300ms),
prefers-reduced-motion respected, haptics via navigator.vibrate where supported, sound off by default.
Use Tailwind, Radix primitives, framer-motion, lucide-react, next-themes (dark default, system/time-aware toggle, no
flash on load) and an optional AMOLED black theme. Verify contrast against WCAG AA with axe.
Dark map: CSS filter on the existing OSM tiles (no new hosts).

Layouts: mobile 360-430px = full-screen map + draggable bottom sheet + thumb-zone primary button + 4-tab bottom nav
(Ride, Rewards, Trips, Profile). 768px and up = left rail, centre map, right detail panel; admin = bento dashboard
with Ctrl+K command palette. Test at 360, 390, 768, 1024, 1440.

C1. Foundation: tokens, theme provider, typography, /components/ui library (Button, Card, Sheet, Tabs, Badge, Avatar,
    Slider, Progress, Ring, Stepper, Toast, Skeleton, EmptyState, Dialog), motion primitives, layout shells.
C2. Onboarding: replace the first screen with a hero showing the saving ("Landing at BOM? Share a cab home and save
    up to 50%"), a flight-number input and "See my fare". Show the fare preview and pool radar BEFORE login. Ask for
    name, phone and OTP only when the rider confirms a pool. Ask gender only if the rider turns on women-only pool,
    with a short privacy note. Move test personas into a small "Try demo" button (demo mode only). Replace "Step 1 of
    5" with a flight-path progress line.
C3. Flight picker: one full-page scroll (no nested scrolling list), sticky bottom confirm button, terminal and airline
    filter chips, search. On each card make "N passengers waiting" the headline with corridor chips (for example "2 to
    Thane, 1 to Powai"); drop the repeated "Origin" label and show a code plus city. Style like an arrivals board with
    subtle split-flap motion on status changes. Replace the red SOS pill with a calm Safety Shield icon that expands.
    Desktop: 3 panes (flights, map, fare preview).
C4. Rider journey screens: 6-box OTP input, boarding-pass hero card (tear-off animation on confirm), destination map
    with glowing corridors and a pulsing airport beacon, fare card with animated savings ring and a Wait-vs-Save
    slider (live rupee and minute values, haptic ticks), pool radar with formation-flight animation, payment sheet,
    live trip with flight-path trail and always-visible Safety Shield (share, check-in, SOS), arrival "landing"
    celebration, receipts, settings (theme, language, motion). Add a "Landing Wave" split-flap board page using
    existing data. Language toggle (English, Hindi, Marathi) replacing double-labelled text.
C5. Game layer (mock data, demo mode only): Rewards tab; Flight Score gauge 0-1000 (Reliability 30, Community 25,
    Safety 20, Loyalty 15, Profile 10) with a "why did my score change" list; tiers Taxi, Takeoff, Cruise, Jet Stream,
    Supersonic with perks; XP bar and ranks Ground Crew, Cadet, First Officer, Captain, Commander, Ace; Miles balance
    and a rewards store (credit only, no cash-out, deterministic rewards); season and trip quests (not daily streaks)
    with a streak freeze; badges (First Landing, Boarding Buddy, Mumbai Explorer, Night Owl Safe, Green Miles, Quick
    Boarder, Co-pilot, Frequent Flyer); passport stamps per zone; opt-in nickname leaderboard (weekly Green Miles);
    post-ride landing screen (XP fill, rings for Saved/Waited/Green, Miles, badge unlock, Kudos stickers, shareable
    "Ride Wrapped" card rendered client-side); optional "Gate Trivia" for the baggage wait (never while a trip is
    active). No random paid rewards, no fake urgency, easy opt-out. Co-riders only ever see a "Trusted Rider" badge,
    never the score.
C6. Driver, marshal and admin refresh: earnings card, route steps, OTP entry; marshal bay view; admin bento KPIs, live
    pools, incident board, simulator (demo mode only), command palette. RBAC behaviour unchanged.
C7. Quality: accessibility pass (focus order, labels, zoom, reduced motion) with @axe-core/playwright checks;
    performance (lazy-load map and motion-heavy parts, no layout shift, optimised fonts); skeleton, empty and error
    states; PWA manifest; Playwright screenshots saved to docs/screenshots (390x844 and 1440x900, dark and light) for
    the main screens. Record Lighthouse numbers you actually measure in docs/UI_REPORT.md; do not claim any you did not.

PART D - DOCUMENTATION AND DEPLOY NOTES (no deploying)
D1. Write docs/DESIGN_SYSTEM.md, docs/GAMIFICATION.md (rules, formulas, guardrails, mock vs real), docs/UI_REPORT.md,
    update README and docs/DEMO_SCRIPT.md.
D2. Write docs/DEPLOY_STEPS.md: list every new migration (name and effect), every new environment variable and
    whether it is needed for Preview and Production, the vercel.json plan note, and this exact order:
    1) run node scripts/migrate-live.mjs against Neon, 2) add new Vercel variables, 3) merge to main.
    Also list the tables and APIs needed to make the game layer real (xp_events, badges, user_badges, quests,
    user_quests, reward_catalog, redemptions, score_events, streaks).
D3. Final: run node scripts/verify.mjs, commit locally on mega-upgrade, print the contents of docs/VERIFY_REPORT.md,
    then STOP. Do not push and do not deploy.

BEGIN with the preflight check, then Part A.
```

## After the agent finishes

1. `node scripts\verify.mjs` (everything must say OK, warnings are explained in the report).
2. `node scripts\ship.mjs "Mega upgrade: fixes, admin metrics, premium UI"` pushes the branch to GitHub.
3. Look at the Vercel preview. If Preview variables are missing, tick Preview for each variable in Vercel settings.
4. Going live, in this order:
   - Open a NEW Command Prompt, `cd` into the FlightPool folder, then:
     `set "DATABASE_URL=your direct Neon string"` and `node scripts\migrate-live.mjs` (type MIGRATE LIVE when asked), then close the window.
   - Add any new variables listed in `docs/DEPLOY_STEPS.md` to Vercel.
   - Merge `mega-upgrade` into `main` on GitHub (Pull request, then Merge).
5. If the live site breaks: Vercel, Deployments, last good one, Promote to Production.
