# Auto-Renew (Semi-Automatic) — Design

**Date:** 2026-07-24
**Status:** Approved (pending spec review)

## Summary

Turn monthly packages into a semi-automatic subscription (bank-transfer, no payment
gateway). Each cycle: the system auto-creates a renewal request before expiry → the
tenant uploads their transfer receipt → the owner confirms with one click → the plan
extends by **+1 calendar month, forward-stacking**. The owner's only action is confirming
payment.

Builds on [[nerona-monthly-package-expiry]] (`AgentProfile.planExpiresAt`,
`License.validUntil`, the agent expiry gate) and reuses the existing
`OrderRequest` + payment-proof + `/admin/orders` fulfill flow.

## Key decisions

- **Semi-automatic**, no gateway: owner confirms each payment; everything else automatic.
- **Renewal auto-generated** by a daily cron, **3 days** before expiry (or once lapsed).
  Tenant uploads the receipt; tenant does not have to re-request.
- **First activation** keeps the existing rule: expires at **end of current calendar
  month** (`monthlyExpiryFrom`). **Renewals** add **+1 month forward-stacking** from
  `max(now, current expiry)`.
- Scope mirrors the expiry feature: **agent renewal is enforced**; **metadata renewal
  extends `validUntil` only** (extension validates via Google Sheet; not enforced here).

## Data model

- Add `OrderRequest.isRenewal Boolean @default(false)` (migration). Auto-generated
  renewals set it `true`; initial requests stay `false`.
- Reuse existing `AgentProfile.planExpiresAt`, `License.validUntil`, and all `OrderRequest`
  proof fields.

## Backend

### `src/lib/billing-period.ts` (extend)
- Keep `monthlyExpiryFrom(now)` (end of current month, WIB) — for INITIAL activation.
- Add `addOneMonthJakarta(base: Date): Date` — one calendar month after `base` in WIB
  (via `Date.UTC(y, m+1, day, ...)`, WIB offset applied; JS handles month/day overflow).
- Add `renewedExpiryFrom(currentExpiry: Date | null, now: Date): Date` =
  `addOneMonthJakarta(currentExpiry && currentExpiry > now ? currentExpiry : now)`
  (forward-stacking: extend from remaining time if still active, else from now).

### Renewal-aware fulfillment — `src/lib/orders.ts` `fulfillOrderRequest`
- If `order.isRenewal`:
  - **agent:** read the profile's current `planExpiresAt`; set
    `planExpiresAt = renewedExpiryFrom(planExpiresAt, now)` in the upsert (status active,
    plan unchanged from the order).
  - **metadata:** read the user's active license `validUntil`; pass
    `validUntil = renewedExpiryFrom(validUntil, now)` into `grantLicense`.
- If NOT a renewal: current behavior (agent → `monthlyExpiryFrom(now)`; `grantLicense` →
  its default `monthlyExpiryFrom(now)`).
- `grantLicense` gains an optional `validUntil?: Date` in its options; when provided it's
  used, else it defaults to `monthlyExpiryFrom(new Date())` (unchanged default).

### Auto-generate renewals — `src/lib/billing/renewals.ts` (new)
`generateDueRenewals(now = new Date(), leadDays = 3): Promise<{ created: number }>`:
- **Agent:** for each `AgentProfile` with `plan ∈ {pro, business}`, `status = "active"`,
  `planExpiresAt != null`, `planExpiresAt <= now + leadDays days`, and NO existing
  `pending` `OrderRequest` with `product = "agent"` for that user → create
  `OrderRequest { userId, product: "agent", planName: Title(plan), isRenewal: true,
  status: "pending" }`.
- **Metadata:** for each active `License` (`status ∈ {active, comp}`) with
  `validUntil != null`, `validUntil <= now + leadDays days`, a paid plan, and NO existing
  `pending` metadata `OrderRequest` for that user → create the analogous renewal request
  (`planName` = the license's plan name).
- Dedup strictly on "an existing pending request for the same user+product" so the cron is
  idempotent (safe to run daily).

### Cron endpoint — `src/app/api/billing/renewals/route.ts` (new)
- `GET`, guarded exactly like `src/app/api/agent/cron/route.ts` (`CRON_SECRET` +
  `Authorization: Bearer` header → 401 otherwise). Calls `generateDueRenewals()`.
- `vercel.json`: add `{ "path": "/api/billing/renewals", "schedule": "0 1 * * *" }`
  (daily 01:00 UTC = 08:00 WIB).

## UI

### Tenant — pending-renewal banner
- Helper `listPendingRenewals(userId)` (or reuse `listUserOrders` filtered to
  `status:"pending"`, `isRenewal:true`).
- On `/finance` (top, above "Paket"): if a pending renewal exists, show a highlighted
  banner "Perpanjangan paket jatuh tempo — Upload bukti transfer" linking to
  `/order/<id>` (the existing order-detail page already renders the bank details +
  `PaymentProofUpload`). No new upload plumbing needed.
- (Optional, same banner on `/dashboard`.)

### Admin — renewal marker
- `/admin/orders` (`AdminOrdersPanel`) already lists pending requests with proof + a
  Fulfill button. Add a small "Perpanjangan" badge when `isRenewal` is true so the owner
  can tell renewals from first-time orders. The list endpoint (`listPendingOrderRequests`)
  adds `isRenewal` to its `select`. Fulfilling already routes through `fulfillOrderRequest`
  (now renewal-aware), so confirming = extend +1 month.

## Data flow (monthly)

1. Cron (daily, 3 days pre-expiry) → creates a pending `isRenewal` `OrderRequest`.
2. Tenant sees the banner on `/finance`, opens `/order/<id>`, transfers, uploads receipt.
3. Owner opens `/admin/orders`, sees the "Perpanjangan" request + receipt, clicks Fulfill.
4. `fulfillOrderRequest` extends `planExpiresAt` / `validUntil` by +1 month
   (forward-stacking) and marks the request fulfilled. Agent keeps working.

## Error handling / edge cases

- Cron idempotent: re-running never double-creates (pending-request dedup).
- Renewal fulfilled while still active → forward-stacks onto remaining time (no loss).
- Renewal fulfilled after lapse → extends from `now` (+1 month).
- No `CRON_SECRET` or bad bearer → 401 (cron does nothing).
- Metadata renewal extends `validUntil` in DB only (enforcement remains in the sheet).

## Testing

- `billing-period`: `addOneMonthJakarta` (mid-month, month-boundary, Dec→Jan); 
  `renewedExpiryFrom` (future expiry → +1 month from it; null/lapsed → +1 month from now).
- `generateDueRenewals`: creates for a due paid agent sub & due license; skips when a
  pending request already exists; skips free / not-yet-due; idempotent on second run.
- `fulfillOrderRequest`: `isRenewal` agent → `planExpiresAt` extended via
  `renewedExpiryFrom`; `isRenewal` metadata → license `validUntil` extended; non-renewal
  → unchanged (still `monthlyExpiryFrom`).
- Cron route: 401 without the secret; calls `generateDueRenewals` with it.
- UI (banner, badge) verified via `npm run build`.

## Not doing (YAGNI / later)

- Payment gateway / recurring auto-charge (explicitly semi-auto).
- Auto-fulfilling without the owner (owner confirmation is required by design).
- Metadata enforcement (still Google-Sheet-driven).
- Email/WA reminders to the tenant about the due renewal (banner only for now).
- Auto-downgrade/disable on lapse beyond the existing agent expiry gate.
