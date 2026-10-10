# FlightPool Design System: Night Runway

## 1. Overview & Aesthetic Direction
**Night Runway** is a dark-first, premium flight-deck design system engineered specifically for airport shared mobility at Mumbai Airport (Chhatrapati Shivaji Maharaj International Airport - BOM). It borrows visual motifs from aviation instrument clusters, digital boarding passes, and night runway lighting.

- **Primary Motif**: Aviation boarding pass, runway lighting beacon, split-flap arrivals board.
- **Core Themes**:
  - **Night Runway (Dark, Default)**: Sleek cockpit ambiance with glowing amber, teal, and violet accents.
  - **Daylight Terminal (Light)**: Clean, high-contrast, modern architectural airport terminal aesthetic.
  - **AMOLED Deep Deck**: Pure black (`#000000`) for high-efficiency OLED mobile displays.

---

## 2. Design Tokens

### Color Palette
| Token | Dark (Night Runway) | Light (Daylight Terminal) | AMOLED Black | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `--background` | `#070A12` | `#F5F7FB` | `#000000` | App background |
| `--surface` | `#0E1424` | `#FFFFFF` | `#06080F` | Cards, panels, modals |
| `--surface-2` | `#141C30` | `#EEF2F9` | `#0D111C` | Secondary containers, inputs |
| `--surface-border` | `#1F2942` | `#E2E8F0` | `#1A2234` | Structural borders |
| `--text` | `#EAF0FF` | `#0B1020` | `#FFFFFF` | Primary headings & copy |
| `--text-muted` | `#8A94B2` | `#64748B` | `#7E88A6` | Labels, timestamps, subtext |
| `--primary` | `#FFB020` | `#D98200` | `#FFB020` | Primary runway amber |
| `--accent` | `#2DE2C4` | `#00A88E` | `#2DE2C4` | Airport corridor teal |
| `--rewards` | `#7C6CFF` | `#6351F0` | `#7C6CFF` | Gamification & Miles violet |
| `--success` | `#3DDC97` | `#059669` | `#3DDC97` | Verified status, carbon saved |
| `--danger` | `#FF5C6C` | `#DC2626` | `#FF5C6C` | SOS, critical alerts |

### Typography (`next/font`)
No external unmanaged font hosts are imported. Fonts are built using Next.js managed fonts with zero layout shift:
- **Display Headings**: `Space Grotesk` (Aviation title aesthetic, bold geometric cuts).
- **Body & UI**: `Inter` (Optimized legibility across mobile touch targets).
- **Aviation Codes & Numbers**: `JetBrains Mono` (PNR, seat, flight numbers, currency, timestamps).
- **Indic Scripts**: `Noto Sans Devanagari` (Native Hindi & Marathi typography).

### Border Radii & Elevation
- **Card / Sheet Radius**: `24px` (`rounded-3xl` / `rounded-2xl`)
- **Button / Input Radius**: `16px` (`rounded-xl`)
- **Pill / Badge Radius**: `9999px` (`rounded-full`)
- **Shadows**: Subtle colored glows (`shadow-[var(--primary)]/20`, `backdrop-blur-md`).

---

## 3. UI Component Library (`components/ui/`)

| Component | File | Primitives & Capabilities |
| :--- | :--- | :--- |
| **Button** | `components/ui/Button.tsx` | Variants (`primary`, `secondary`, `accent`, `outline`, `ghost`, `danger`, `success`, `destructive`), sizes (`sm`, `md`, `lg`, `icon`), built-in haptic vibration (`navigator.vibrate`), loading spinner. |
| **Card** | `components/ui/Card.tsx` | Glassmorphic surface containers with border tokens, header, content, and footer primitives. |
| **Badge** | `components/ui/Badge.tsx` | Variants (`default`, `primary`, `accent`, `rewards`, `success`, `warning`, `danger`, `outline`, `solo`, `glow`). |
| **Avatar** | `components/ui/Avatar.tsx` | Radix Avatar primitive with fallback initials. |
| **Slider** | `components/ui/Slider.tsx` | Radix Slider primitive with smooth thumb tracking and haptic tick support. |
| **Progress** | `components/ui/Progress.tsx` | Radix Progress primitive with runway gradient fill. |
| **Ring** | `components/ui/Ring.tsx` | Animated SVG radial progress gauge with children overlay for metrics and percentages. |
| **Stepper** | `components/ui/Stepper.tsx` | Flight-path animated journey line with aircraft node icon. |
| **Tabs** | `components/ui/Tabs.tsx` | Radix Tabs primitive for accessible segmented switching. |
| **Dialog** | `components/ui/Dialog.tsx` | Radix Dialog modal for alerts and confirmations. |
| **Sheet** | `components/ui/Sheet.tsx` | Draggable bottom sheet for mobile viewport (360px - 430px). |
| **Skeleton** | `components/ui/Skeleton.tsx` | Pulse-animated content placeholder for zero-shift loading states. |
| **EmptyState** | `components/ui/EmptyState.tsx` | Structured zero-data visual card with actionable button. |
| **Toast** | `components/ui/Toast.tsx` | Radix Toast primitive for non-intrusive status updates. |

---

## 4. Map & Corridor Theming
To adhere strictly to zero external host leakage:
- OpenStreetMap tile raster requests are filtered through a high-performance CSS filter:
  ```css
  .dark .leaflet-tile-pane,
  .amoled .leaflet-tile-pane {
    filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
  }
  ```
- **Airport Beacon**: Pulsing amber circle centered at BOM coordinates (`19.0896, 72.8656`).
- **Corridors**: Luminous teal polylines showing optimal routes to Thane, Mulund, Powai, Andheri, Bandra, and Navi Mumbai.

---

## 5. Responsive Layout Architecture
1. **Mobile (360px - 430px)**:
   - Full viewport experience with sticky thumb-zone confirmation buttons.
   - 4-tab bottom navigation (`Ride`, `Rewards`, `Trips`, `Profile`).
   - Draggable bottom sheet with step progress.
2. **Desktop (768px - 1440px)**:
   - 3-pane layout:
     - Left Rail (5 cols): Flight selection, PNR verification, corridor picker.
     - Center (4 cols): Live interactive Mumbai corridor map.
     - Right Detail Panel (3 cols): Upfront fare transparency, pool radar, and fleet stats.
3. **Admin Dashboard**:
   - Bento box KPI layout with 6 essential fleet metrics.
   - Live Command Palette (`Ctrl+K` / `Cmd+K`) for rapid airport dispatch navigation.
