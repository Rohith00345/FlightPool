# Money Units Architecture: Integer Paise Standard

## 1. Executive Summary & Principle
In FlightPool, **integer paise (`1 INR = 100 paise`)** is the sole authoritative currency unit across:
- Pricing engine calculations (`calculateSoloFarePaise`, `calculatePoolPricingPaise`)
- Fare quotes stored and served (`FareQuote.soloFarePaise`, `FareQuote.poolFarePaise`)
- Pool matching and individual rider shares
- Payment authorizations and webhooks (`Payment.amountPaise`, Razorpay API payloads)
- Double-entry accounting ledger entries (`LedgerEntry.amountPaise`)
- Driver payouts and commissions (`Payout.grossPaise`, `Payout.commissionPaise`, `Payout.netPaise`)
- Frontend state and calculation pipes

Floating-point rupee values are strictly banned from financial storage, ledger balancing, and API contracts.

---

## 2. Invariant Rules
1. **Never Store Floating-Point Rupees in the Database**: All currency columns are defined as `Int` or `BigInt` storing whole paise.
2. **Zero Paise Leakage**: In every pool pricing calculation:
   $$\sum \text{riderShares.poolFarePaise} \equiv \text{totalPoolFarePaise}$$
   $$\text{platformFeePaise} + \text{driverPayoutPaise} \equiv \text{totalPoolFarePaise}$$
3. **Double-Entry Balance**:
   $$\sum \text{DEBITS} \equiv \sum \text{CREDITS}$$
   For every ledger transaction ID, debits and credits must balance to the exact single paisa.
4. **Isolated Presentation Conversion**: Rupee conversion occurs exclusively at the final rendering boundary via `formatPaiseToRupees(paise)`.

---

## 3. Explicit Conversion Points Across the Stack

| Layer | Component / File | Input Unit | Output Unit | Conversion Logic | Validation Guard |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pricing** | `lib/pricing/index.ts:calculateSoloFarePaise` | Distance (km), Multiplier | Integer Paise | `Math.round(rawFare) * 100` | `assertStrictPaise` |
| **Pricing** | `lib/pricing/index.ts:calculatePoolPricingPaise` | Distance, Rider list | Integer Paise | Computes shares in paise with exact remainder allocation | `assertStrictPaise` |
| **Quotes** | `app/api/pools/[id]/re-quote/route.ts` | Pricing engine | Integer Paise | Stored in `FareQuote.soloFarePaise`, `FareQuote.poolFarePaise` | Schema `Int` |
| **Payment Gateway** | `app/api/payments/webhook/route.ts` | Razorpay webhook payload | Integer Paise | Razorpay sends amount in paise; stored directly in `Payment.amountPaise` | `assertStrictPaise` |
| **Ledger Engine** | `lib/ledger.ts:postFarePayment` | Payment amount in paise | Integer Paise | Posts balancing DEBIT/CREDIT entries to `LedgerEntry.amountPaise` | `assertStrictPaise`, debits === credits |
| **Driver Payouts** | `lib/ledger.ts:processWeeklyDriverPayouts` | Driver payable balance | Integer Paise | Creates `Payout` records with `grossPaise` & `netPaise` | `assertStrictPaise` |
| **UI Presentation** | `lib/pricing/index.ts:formatPaiseToRupees` | Integer Paise | Formatted String (`₹...`) | `paise / 100` with `en-IN` locale number formatting | `assertStrictPaise` throws if fractional or NaN |

---

## 4. Test Verification
All invariants are asserted in:
- `tests/money-units.test.ts`: Rejection of fractional floats, exact penny sum conservation, and conversion integrity.
- `tests/ledger.test.ts`: Double-entry balancing with odd paise and zero leakage.
