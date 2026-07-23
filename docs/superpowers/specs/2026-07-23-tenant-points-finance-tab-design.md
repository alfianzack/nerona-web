# Tenant Points & Finance Tab — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)

## Summary

On the admin user detail page (`/admin/users/[id]`), show a **points balance** for
the tenant owner and add a **Finance tab** that lists what the tenant has bought on
Nerona (plan activations such as Pro/Business) alongside their point transactions.

Points are a **prepaid credit wallet** (points in via top-up, spent on Nerona services).
In this first build the balance goes **up** through **admin manual adjustments** and
goes **down** when the WhatsApp agent makes an AI call — the cost of each call is
metered from its **token usage × the model's USD price**, converted to points at a fixed
`POINTS_PER_USD` rate. Points are displayed as an abstract count (e.g. "1.250 poin");
the USD rate is an internal conversion, not shown to tenants and not tied to rupiah.

The agent defaults to the **cheapest model** available (e.g. a Gemini Flash-lite) so a
balance stretches as far as possible; a per-model price table makes the metered cost
accurate.

**Hard rules:**
- The balance floor for **manual adjustments** is **0** — an admin adjustment can never
  drive the balance below 0.
- When a tenant's balance is **≤ 0**, the agent **must not call the AI API**. It replies
  with a short "poin habis" message instead. (Because a call's exact cost is only known
  after it returns, one final call may leave the balance slightly negative; the next
  message is then blocked — normal metered-billing behavior.)

Out of scope for this build (but the model must support them without migration):
self-serve top-up, a payment/checkout flow, and model fallback/routing.

## Terminology

- **Tenant owner** — a `User` (shown as "Pengguna" in the admin), who may own a
  WhatsApp `AgentProfile` and/or licenses. There is no separate `Tenant` model.
- **Point** — a unit of prepaid credit held in the user's wallet. Displayed as an
  abstract count; internally 1 point = `1 / POINTS_PER_USD` USD when metering AI cost.

## Data model

One new Prisma model — an append-only ledger. Balance is derived, never stored.

```prisma
model PointTransaction {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation("UserPointTransactions", fields: [userId], references: [id], onDelete: Cascade)
  delta       Int      // signed: positive = credit, negative = debit
  reason      String   // "manual_adjust" | "spend" (future: "topup")
  note        String?
  createdById String?  // admin who recorded it
  createdBy   User?    @relation("PointAdjustedByAdmin", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())

  @@index([userId])
  @@map("point_transactions")
}
```

`User` gains two back-relations: `pointTransactions PointTransaction[] @relation("UserPointTransactions")`
and `adjustedPointTransactions PointTransaction[] @relation("PointAdjustedByAdmin")`.

**Balance** = `SUM(delta)` over the user's transactions. Computed on read (volume is
tiny). No cached balance column.

**Rationale:** a wallet is a ledger. History and audit ("who changed what, when") come
for free, and future top-up / spend are just new `reason` values on the same table —
no schema change.

## Backend

### Adjust endpoint — `POST /api/admin/points`
- Admin-guarded (same pattern as `/api/admin/licenses`: `getServerSession` + role check).
- Body: `{ userEmail | userId, delta: number, note?: string }`.
- Validates `delta` is a non-zero integer.
- Creates a `PointTransaction { userId, delta, reason: "manual_adjust", note, createdById: session.user.id }`.
- Returns `{ ok: true, balance }` (new balance) so the UI can update without a refetch.
- **Floor guard:** rejects with 400 (`saldo tidak boleh minus`) if `currentBalance + delta < 0`.
  The wallet can never go negative.

### Read
The detail page loads server-side (it is already an async server component):
- `balance` — `prisma.pointTransaction.aggregate({ _sum: { delta }, where: { userId } })`.
- `transactions` — recent `PointTransaction`s (newest first, capped, with `createdBy` name).
- `purchases` — unified list, newest first:
  - fulfilled `OrderRequest`s → `{ kind: "plan", product, planName, date: fulfilledAt }`
  - `Order`s → `{ kind: "order", amount, currency, note, courseId, date: createdAt }`

Helper functions live in a new `src/lib/points.ts` (`getBalance`, `adjustPoints`,
`listTransactions`, `spendPoints`) so the route, page, and agent share one source of
truth, mirroring `lib/admin-grants.ts`:
- `getBalance(userId)` → sum of deltas (null → 0).
- `adjustPoints({ userId, delta, note, createdById })` → enforces the floor guard,
  creates a `manual_adjust` row, returns `{ ok, balance | reason }`.
- `spendPoints({ userId, cost, note })` → records the metered cost of a call that has
  already happened: creates a `spend` row with `delta = -cost` (unconditionally — the
  pre-call gate, not this helper, decides whether the AI runs, so a spend may take the
  balance slightly negative) and returns the new balance. `createdById` is null for
  agent spends. `cost` is a positive integer from `costForUsage`.

### Cost model & pricing

Cost is metered from token usage. `generateReply` is changed to return usage and the
model used alongside the text:
`{ text, model, usage: { promptTokens, completionTokens } }` (read from the
OpenAI-compatible response's `usage.prompt_tokens` / `completion_tokens`).

A price table maps model → USD price per **1M tokens**, kept in `lib/agent/pricing.ts`:

```ts
// USD per 1,000,000 tokens. Extend as models are added.
const MODEL_PRICES = {
  "gemini-2.0-flash-lite": { in: 0.075, out: 0.30 },
  "gemini-2.0-flash":      { in: 0.10,  out: 0.40 },
  "claude-sonnet-4-6":     { in: 3.00,  out: 15.00 },
  // ...
};
const DEFAULT_PRICE = MODEL_PRICES["gemini-2.0-flash-lite"]; // fallback for unknown model
const POINTS_PER_USD = Number(process.env.POINTS_PER_USD ?? 100_000);
```

Point cost of one call:

```
usd  = promptTokens/1e6 * price.in + completionTokens/1e6 * price.out
cost = max(1, ceil(usd * POINTS_PER_USD))   // always at least 1 point per answered call
```

`costForUsage({ model, usage })` in `pricing.ts` returns this integer. Unknown model →
`DEFAULT_PRICE` (and a `console.warn`) so a mispriced model over-charges toward the
cheap default rather than costing 0. The concrete price numbers are placeholders to be
confirmed against the provider's actual rates during implementation.

The agent's default model becomes the cheapest entry via `AGENT_MODEL`
(`lib/agent/claude-client.ts` already reads `process.env.AGENT_MODEL`); the default is
set to a Gemini Flash-lite id the provider (Sumopod) actually serves. No fallback chain.

### AI spend + gate (WhatsApp agent)

In `lib/agent/process-job.ts`, around the single `generateReply()` call:

1. Load `profile.userId`.
2. **Gate (before the AI call):** if `getBalance(userId) <= 0`, do NOT call
   `generateReply`. Send a short Indonesian "poin habis" message to the tenant
   (`sendWhatsAppText` + `logOutbound`), `completeJob`, and return. This is a normal
   completion, not a job failure (no retry, no apology message).
3. **Spend (after a successful AI call + send):** compute `cost = costForUsage({ model,
   usage })` from the returned usage, then call `spendPoints({ userId, cost, note })`
   where the note records the model and tokens (e.g. `"AI reply · gemini-2.0-flash-lite
   · 1.5k+0.35k tok"`), creating the `spend` ledger row (`delta = -cost`). Deduct only
   after a successful reply so failed/retried calls are never charged. A best-effort
   spend failure must not break the reply that already went out.

The gate checks `balance <= 0` rather than `< cost` because the exact cost is unknown
until the call returns; this means one call can complete against a near-empty wallet and
leave a small negative balance, after which the gate blocks the next message. Jobs are
drained largely sequentially by the cron worker, so concurrent overspend for the *same*
tenant is rare and bounded to a call or two. A strict never-negative guarantee
(conditional/locked decrement) is deliberately not implemented at this volume — the
floor guard on *manual* adjustments is the hard rule; agent overspend is transient.

## UI

Restructure `/admin/users/[id]` from "just renders `UserPlanManager`" into:

**Header** (server-rendered): tenant name / email + a prominent **points balance chip**
(e.g. gold pill "1.250 poin"). This is the "show point on tenant owner" requirement.

**Tabs** (client component, e.g. `UserDetailTabs`):
- **Paket** — the existing `UserPlanManager`, unchanged.
- **Finance** — new `UserFinancePanel`:
  - *Poin* — current balance, a "Sesuaikan poin" form (signed amount + note →
    `POST /api/admin/points`, optimistic balance update), and the transaction history
    (delta, reason, note, admin, date).
  - *Pembelian* — the unified purchase list: plan activations ("Agent — Business",
    date) and rupiah orders (amount + note + date). Read-only.

Tab state is client-side (`useState`), default "Paket". Styling reuses the existing
admin card / pill / button classes already used in `UserPlanManager` and
`AdminUsersDirectory` (brand-blue / gold, darkened hues for contrast).

Copy is Indonesian, consistent with the rest of the admin ("Poin", "Sesuaikan poin",
"Pembelian", "Riwayat poin").

## Data flow

1. Admin opens `/admin/users/[id]` → server loads balance + transactions + purchases,
   renders header (with balance) + tabs.
2. Admin opens **Finance** → sees Poin (balance + history) and Pembelian sections.
3. Admin submits "Sesuaikan poin" → `POST /api/admin/points` → new `PointTransaction`,
   returns new balance → UI updates balance chip and prepends the transaction row.

## Error handling

- Non-admin → 401 (route guard).
- Invalid/zero/non-integer `delta` → 400 with an Indonesian message.
- Adjustment that would make balance < 0 → 400 (`saldo tidak boleh minus`).
- User not found → 404.
- Balance aggregate over zero rows → treat null sum as `0`.
- Agent, balance ≤ 0 → no AI call; tenant gets the "poin habis" message; job completes
  normally (not a failure, no retry).
- AI response missing `usage` → fall back to a conservative default cost (treat as the
  default model's typical reply, min 1 point) rather than charging 0; log a warning.
- Unknown model in the price table → use `DEFAULT_PRICE` + warn.
- Agent, `spendPoints` fails after a reply already sent → logged, swallowed; the reply
  stands (best-effort deduction).

## Testing

- Unit (vitest) for `lib/points.ts`: balance = sum of deltas; empty ledger → balance 0;
  `adjustPoints` creates a `manual_adjust` row with the right sign/admin; floor guard
  rejects an adjustment that would go below 0; `spendPoints` always creates a `spend`
  row and can take the balance negative.
- Unit for `lib/agent/pricing.ts` (`costForUsage`): known model computes
  `ceil(usd * POINTS_PER_USD)`; result is floored to a minimum of 1; unknown model uses
  `DEFAULT_PRICE`; zero/absent usage → the conservative default cost.
- Route `/api/admin/points`: rejects non-admin (401), rejects zero/invalid delta (400),
  rejects a below-zero adjustment (400), creates a transaction and returns the updated
  balance on success.
- Agent gate (`process-job`): with balance ≤ 0 the AI client is not called, a "poin
  habis" message is sent, and the job completes without a spend row; with a positive
  balance the reply is sent and exactly one `spend` row is created whose `delta` equals
  `-costForUsage(...)`.

## Not doing (YAGNI)

- Cached balance column.
- Self-serve top-up flow and payment/checkout integration.
- Admin-editable price table / `POINTS_PER_USD` UI (both are code/env for now).
- Model fallback or routing (default to a single cheapest model only).
- Metering AI surfaces other than the WhatsApp agent (e.g. the metadata extension).
- Strict never-negative concurrency guarantee for agent spends (see AI spend + gate).
- Showing tenants the USD/rupiah value of points (points display as an abstract count).
- Points on the users list table (only the detail header for now).
