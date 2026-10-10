# FlightPool Gamification Layer: FlightDeck

## 1. Core Principles & Ethical Guardrails
FlightPool's gamification system ("FlightDeck") is engineered around utility, environmental sustainability, and passenger punctuality rather than predatory addiction loops:
1. **No Fake Urgency or Artificial Scarcity**: Countdown timers exist solely for real-world wait caps (e.g. 20-minute departure window) or airline schedule arrivals.
2. **Deterministic Rewards Only**: No loot boxes, no gambling mechanics, and no cash-outs. Rewards are strictly ride credits and priority dispatch perks.
3. **No Social Scoring Exposure**: Co-passengers never see other riders' numeric Flight Scores. They only see an egalitarian **"Trusted Rider"** verification badge.
4. **No Punitive Streaks**: FlightPool avoids daily streaks (air travelers do not fly daily). Instead, season quests and trip-based milestones are used, equipped with a **Streak Freeze** protection mechanism.
5. **Fail-Closed Demo Boundary**: When demo mode is disabled (`DEMO_MODE !== "true"`), all gamification elements display an honest, tasteful **"Rewards coming soon"** placeholder. Mock data is never shown as live production data.

---

## 2. Flight Score Architecture (0 - 1000)

The Flight Score is a comprehensive measure of a passenger's punctuality, community ratings, and safety adherence.

$$\text{Flight Score} = \sum_{i=1}^5 \text{Category Score}_i \quad (\text{Max } 1000)$$

### Category Breakdown
| Category | Weight | Max Points | Measurement Metric |
| :--- | :---: | :---: | :--- |
| **Reliability** | 30% | 300 | Arriving at terminal bay on time; zero late cancellations. |
| **Community** | 25% | 250 | High driver and co-rider ratings ($\ge 4.8\star$); luggage courtesy. |
| **Safety** | 20% | 200 | Verified airline boarding pass; emergency contact linked; OTP verified. |
| **Loyalty** | 15% | 150 | Completed airport pooling trips from Terminal 1 & 2. |
| **Profile** | 10% | 100 | Verified passenger name, DPDP consent, emergency contact on file. |

### Tiers & Perks
| Tier | Score Range | Active FlightDeck Perks |
| :--- | :---: | :--- |
| **Taxi** | 0 – 299 | Standard pooling matching; 20m wait cap. |
| **Takeoff** | 300 – 549 | ₹50 ride credit on every 3rd completed pool. |
| **Cruise** | 550 – 749 | Priority bay queuing; 15m expedited match window. |
| **Jet Stream** | 750 – 899 | Guaranteed front-seat preference; ₹100 airport transfer credit. |
| **Supersonic** | 900 – 1000 | Dedicated fast-track Bay P4 dispatch; complimentary solo upgrade if pool unformed. |

---

## 3. Ranks & Aviation XP
Passengers accumulate Aviation XP through completed pool kilometers and carbon reduction:

$$\text{XP Earned} = (\text{Distance Km} \times 10) + (\text{CO}_2 \text{ Saved Kg} \times 25)$$

| Rank | Required XP | Motif |
| :--- | :---: | :--- |
| **Ground Crew** | 0 XP | Entry passenger level. |
| **Cadet** | 500 XP | Completed first verified pool. |
| **First Officer** | 1,500 XP | Multiple successful corridor trips. |
| **Captain** | 3,500 XP | Consistent 5-star community rating. |
| **Commander** | 7,500 XP | Frequent BOM airport pooled traveler. |
| **Ace** | 15,000 XP | Elite corridor champion (&gt;100 kg CO₂ reduced). |

---

## 4. Badges & Passport Stamps

### Aviation Community Badges
1. **First Landing**: Completed first BOM pooled ride.
2. **Boarding Buddy**: Completed a pool with 3 co-passengers.
3. **Mumbai Explorer**: Traveled across all 6 major Mumbai corridors (Thane, Mulund, Powai, Andheri, Bandra, Navi Mumbai).
4. **Night Owl Safe**: Completed a verified late-night pool (between 11 PM and 5 AM).
5. **Green Miles**: Saved over 50 kg of CO₂ through ridesharing.
6. **Quick Boarder**: Boarded cab within 3 minutes of vehicle arrival at Bay P4.
7. **Co-pilot**: Rated 5 stars by all co-passengers on a trip.
8. **Frequent Flyer**: 5 airport pools in a single calendar month.

### Mumbai Corridor Passport Stamps
Every completed ride awards an interactive passport stamp corresponding to the destination zone (e.g. *BOM → Thane Eastern Express Corridor*, *BOM → Powai JVLR Corridor*).

---

## 5. Baggage Wait "Gate Trivia"
- While passengers wait at baggage reclaim (during `SEARCHING` ride state), FlightPool offers an optional 3-question Mumbai aviation quiz.
- **Rules**:
  - Unlocks small non-cash rewards (+25 Green Miles per correct answer).
  - Strictly disabled once a vehicle is assigned or trip is in transit, preventing distraction while boarding.

---

## 6. Post-Ride "Landing Celebration" & Wrapped Card
Upon trip completion:
- **Landing Celebration Screen**: Visual confetti celebrating arrival, showing exact rupees saved and kilograms of CO₂ avoided.
- **Rings**: Visual concentric radial gauges for Rupee Savings (%), Wait Efficiency (%), and Green Carbon Score (%).
- **Ride Wrapped Card**: Client-rendered graphic (shareable via Web Share API) highlighting flight number, corridor, and carbon offset.

---

## 7. Database Migration Blueprint (For Productionizing)
To transition from the current mock provider to live database persistence in Phase 8, the following tables will be provisioned:
1. `xp_events`: Ledger of XP awarded per trip action.
2. `badges`: Master badge catalog with metadata and icons.
3. `user_badges`: Many-to-many unlock ledger for users.
4. `quests`: Catalog of season and trip challenges.
5. `user_quests`: Progress tracking and streak freeze ledger.
6. `reward_catalog`: Redeemable ride discount vouchers.
7. `redemptions`: Idempotent coupon consumption records.
8. `score_events`: Audit trail for every change to a user's Flight Score.
9. `streaks`: Flight frequency and freeze tokens.
