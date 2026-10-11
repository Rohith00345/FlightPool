# FlightPool UI Inventory & Component Audit (`docs/UI_AUDIT.md`)

## 1. Overview
This audit catalogs every page, UI component, identifier, and `data-testid` in FlightPool for the **Night Runway** redesign, verifying consistency, accessibility compliance, and fail-closed demo mode boundaries.

---

## 2. Pages & Routes Inventory

| Route | File Path | Primary Function | Auth / Access | Key Interactive Elements |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `app/page.tsx` | Passenger onboarding, flight picker, boarding verification, corridor select, live pool radar | Public / Rider (OTP auth) | `#login-btn`, `#confirm-flight-btn`, `#verify-pass-btn`, `#request-ride-btn`, `#confirm-pool-btn`, `#global-sos-btn` |
| `/landing-wave` | `app/landing-wave/page.tsx` | Split-flap airport arrival schedules, terminal filters, corridor passenger counts | Public | Terminal filters, flight cards, corridor chips |
| `/admin` | `app/admin/page.tsx` | Bento box KPIs, incident triage, live pools table, flight delay/cancel, simulator | ADMIN role only | KPI cards, command palette (Ctrl+K), incident triage buttons, simulation trigger |
| `/driver` | `app/driver/page.tsx` | Driver earnings, assigned trip manifest, terminal bay check-in, passenger OTP verification | DRIVER role only | Check-in button, start trip OTP input, complete trip button, document upload |
| `/marshal` | `app/marshal/page.tsx` | Airport ground operations bay management, passenger check-in verification | MARSHAL / ADMIN role | Bay status grid (Bays P1-P6), manual verification form |
| `/trip/[id]/live` | `app/trip/[id]/live/page.tsx` | Real-time passenger trip tracker, flight-path trail, emergency SOS | Trip participants | Live map, SOS button, rating modal trigger |
| `/trip/share/[token]` | `app/trip/share/[token]/page.tsx` | Public telemetry share link (DPDP compliant, zero PII) | Public | Telemetry map, vehicle license plate, ETA |
| `/design` | `app/design/page.tsx` | Living design system gallery and component test bed | Demo mode / Dev only | Theme switchers, language chips, component state showcases |

---

## 3. UI Component Primitives Inventory (`components/ui/`)

| Component | Path | Implemented Features |
| :--- | :--- | :--- |
| `Button` | `components/ui/Button.tsx` | Variants: `primary`, `secondary`, `accent`, `outline`, `ghost`, `danger`, `success`, `destructive`. Sizes: `sm`, `md`, `lg`, `icon`. Built-in haptic vibration (`navigator.vibrate`), loading indicator. |
| `IconButton`| `components/ui/Button.tsx` | Accessible square icon button wrapper. |
| `Card` | `components/ui/Card.tsx` | Glassmorphic surface containers (`glass-surface`, `glass-surface-2`) with border tokens. |
| `Badge` | `components/ui/Badge.tsx` | Variants: `default`, `primary`, `accent`, `rewards`, `success`, `warning`, `danger`, `solo`, `glow`. |
| `Avatar` | `components/ui/Avatar.tsx` | Radix Avatar primitive with fallback initials. |
| `Slider` | `components/ui/Slider.tsx` | Radix Slider with haptic tick vibration. |
| `Progress` | `components/ui/Progress.tsx`| Radix Progress bar with runway gradient fill. |
| `Ring` | `components/ui/Ring.tsx` | Animated SVG radial progress gauge with children overlay. |
| `Stepper` | `components/ui/Stepper.tsx` | Flight-path animated journey line with aircraft node icon. |
| `Tabs` | `components/ui/Tabs.tsx` | Radix Tabs primitive for accessible segmented switching. |
| `Dialog` | `components/ui/Dialog.tsx` | Radix Dialog modal for alerts and confirmations. |
| `Sheet` | `components/ui/Sheet.tsx` | Mobile draggable bottom sheet (snap points: peek, half, full). |
| `Toast` | `components/ui/Toast.tsx` | Radix Toast notifications. |
| `Skeleton` | `components/ui/Skeleton.tsx` | Pulsing surface loading skeleton placeholder. |
| `EmptyState`| `components/ui/EmptyState.tsx`| Empty state container with icon and explanation. |
| `ErrorState`| `components/ui/ErrorState.tsx`| Error state container with retry action button. |
| `Tooltip` | `components/ui/Tooltip.tsx` | Accessible keyboard-focused hover tooltip. |
| `Switch` | `components/ui/Switch.tsx` | Accessible switch toggle primitive. |
| `Select` | `components/ui/Select.tsx` | Form select dropdown with chevron icon and label. |
| `Input` | `components/ui/Input.tsx` | Form text input with left/right icons and error states. |
| `OtpInput` | `components/ui/OtpInput.tsx`| 6-digit numeric OTP input with clipboard paste support and auto-advance. |
| `Chip` | `components/ui/Chip.tsx` | Interactive filter toggle chip. |
| `Banner` | `components/ui/Banner.tsx` | Notification banner variants: `info`, `warning`, `success`, `danger`. |

---

## 4. Key Identifiers & Data-TestIDs

- `login-btn`: Main OTP login submission button.
- `confirm-flight-btn`: Flight selection confirmation.
- `verify-pass-btn`: Digital boarding pass verification.
- `request-ride-btn`: "I've landed & ready" corridor dispatch request.
- `confirm-pool-btn`: Pool confirmation and fare lock.
- `global-sos-btn`: Safety Shield trigger in navigation header.
- `otp-input`: 6-box OTP entry container.
- `demo-selector`: Demo persona quick switcher (visible in demo mode only).
- `wait-save-slider`: Slider controlling wait vs savings preference.
- `terminal-filter-all`: Landing wave terminal filter.
- `terminal-filter-t1`: Landing wave Terminal 1 filter.
- `terminal-filter-t2`: Landing wave Terminal 2 filter.
