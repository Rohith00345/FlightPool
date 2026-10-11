# FlightPool Definition of Done (DoD) Checklist

This document tracks the strict quality, accessibility, security, and performance standards enforced across all phases of the FlightPool user interface and core application.

---

## 1. Core DoD Rules (Verified on Every Phase)

- [x] **Verification Script**: `node scripts/verify.mjs` executes and passes with `RESULT: OK` on every phase.
- [x] **Zero Script Modification**: `git diff --stat main -- scripts` is strictly empty. No script in `/scripts` was touched, renamed, deleted, or modified.
- [x] **Local Database Only**: All work strictly executed against the local Docker PostgreSQL database (`localhost:5433`). No remote database connections or remote secrets.
- [x] **Dedicated Branch**: All work executed on branch `fix-live-neon-qa`, never directly on `main`. Zero unauthorized pushes, merges, or deployments.
- [x] **Fail-Closed Demo Mode**: `DEMO_MODE === "true"` and `NEXT_PUBLIC_DEMO_MODE === "true"` fail closed. Outside demo mode, all dev OTPs, test personas, simulator controls, and mock gamification numbers are strictly disabled and return standard production behaviors or "coming soon" states.
- [x] **Existing IDs & TestIDs**: Preserved all existing IDs (`#login-btn`, `#confirm-flight-btn`, `#verify-pass-btn`, `#request-ride-btn`, `#confirm-pool-btn`, `#global-sos-btn`, etc.) and test attributes required by automated testing and monitoring.
- [x] **Zero External Network Hosts**: Zero external CDNs, fonts, tile servers, or tracking scripts. Map uses CSS dark filters on existing OpenStreetMap raster tiles. Fonts are self-hosted via `next/font`. Icons from `lucide-react` only.

---

## 2. Accessibility (WCAG 2.1 AA)

- [x] **Axe Core Automation**: Automated `@axe-core/playwright` audits across `/` and `/design` pass with 0 serious or critical violations.
- [x] **Color Contrast Tokens**: All CSS color tokens defined in `styles/tokens.css` meet or exceed WCAG AA ratio ($4.5:1$ for normal body text, $3:1$ for large text and focus rings).
- [x] **Keyboard Navigation**: All interactive elements (inputs, buttons, tabs, sliders) are reachable and operable via keyboard alone with visible focus rings.
- [x] **Screen Reader Labels**: Icon buttons feature explicit accessible names via `aria-label` or `title` attributes.
- [x] **Responsive Scaling**: Layout supports browser zoom up to 200% without horizontal scrolling or clipping of core text content.

---

## 3. Localization & Internationalization (i18n)

- [x] **Multi-Language Support**: User-facing copy resolved through `lib/i18n/index.ts` supporting English (`en`), Hindi (`hi`), and Marathi (`mr`).
- [x] **Currency & Tabular Numerals**: Fares formatted in Indian Rupees (INR `₹`) with tabular numerals in JetBrains Mono / Inter.
- [x] **Consistent Terminology**: Avoid duplicate dual-language labels; use clean language toggle in header and settings.

---

## 4. Resilience & Error Boundaries

- [x] **Zero Silent Failures**: All network requests and async state updates handle loading, empty, error, and unauthorized states with clear recovery actions.
- [x] **Retry Capabilities**: Failed API requests display clear error messages with user-friendly retry buttons.
- [x] **Bounded Wait Cap**: FlightPool matching strictly adheres to the 20-minute maximum wait cap with explicit rider consent before any solo transition or re-pricing.

---

## 5. Visual Testing & Screenshots

- [x] **Automated Screenshot Manifest**: 12 automated full-page screenshots recorded in `docs/screenshots/` across mobile (390x844) and desktop (1440x900) in dark (Night Runway) and light (Daylight Terminal) modes.
- [x] **Design Gallery**: A living design system gallery is accessible at `/design` in demo/development mode demonstrating all primitives in all themes and states.
