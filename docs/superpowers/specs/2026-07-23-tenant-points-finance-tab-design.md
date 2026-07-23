# Tenant Points & Finance Tab — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)

## Summary

On the admin user detail page (`/admin/users/[id]`), show a **points balance** for
the tenant owner and add a **Finance tab** that lists what the tenant has bought on
Nerona (plan activations such as Pro/Business) alongside their point transactions.

Points are a **prepaid credit wallet** (money in via top-up, spent on Nerona services).
In this first build the balance goes **up** through **admin manual adjustments** and
goes **down** when the WhatsApp agent spends a point per AI reply. Points are an
**abstract count** (displayed as e.g. "1.250 poin") with no fixed rupiah conversion yet.

**Hard rules:**
- The balance floor is **0** — a manual adjustment can never drive it below 0, and the
  agent never spends into the negative.
- When a tenant's balance is **0** (below the per-reply cost), the agent **must not call
  the AI API**. It replies with a short "poin habis" message instead.

Out of scope for this build (but the model must support them without migration):
self-serve top-up and a payment/checkout flow.

## Terminology

- **Tenant owner** — a `User` (shown as "Pengguna" in the admin), who may own a
  WhatsApp `AgentProfile` and/or licenses. There is no separate `Tenant` model.
- **Point** — a unit of prepaid credit held in the user's wallet. Abstract count.

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
- `spendPoints({ userId, cost, note })` → if `balance >= cost`, creates a `spend` row
  with `delta = -cost` and returns `{ ok: true }`; otherwise `{ ok: false }` (caller
  must not have called the AI). `createdById` is null for agent spends.

### AI spend + gate (WhatsApp agent)

In `lib/agent/process-job.ts`, around the single `generateReply()` call:

1. Load `profile.userId` and the per-reply cost (`POINTS_PER_AI_REPLY`, a constant
   defaulting to `1`, overridable via env `AGENT_POINTS_PER_REPLY`).
2. **Gate (before the AI call):** if `getBalance(userId) < cost`, do NOT call
   `generateReply`. Send a short Indonesian "poin habis" message to the tenant
   (`sendWhatsAppText` + `logOutbound`), `completeJob`, and return. This is a normal
   completion, not a job failure (no retry, no apology message).
3. **Spend (after a successful AI call + send):** call `spendPoints({ userId, cost,
   note: "AI reply" })`, creating the `spend` ledger row. Deduct only after success so
   failed/retried calls are never charged. A best-effort spend failure must not break
   the reply that already went out.

The gate reads the balance once at the top. Jobs are drained largely sequentially by
the cron worker, so concurrent spends for the *same* tenant are rare. In that rare case
two in-flight replies could each pass the gate and briefly overspend by a point or two;
the next job then sees balance ≤ 0 and is blocked, so it self-corrects. `spendPoints`
does its `balance >= cost` check inside the same call to keep the window small. A
strict never-negative guarantee (conditional/locked decrement) is deliberately not
implemented at this volume — the floor guard on *manual* adjustments is the hard rule;
agent overspend is bounded and transient.

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
- Agent, balance below cost → no AI call; tenant gets the "poin habis" message; job
  completes normally (not a failure, no retry).
- Agent, `spendPoints` fails after a reply already sent → logged, swallowed; the reply
  stands (best-effort deduction).

## Testing

- Unit (vitest) for `lib/points.ts`: balance = sum of deltas; empty ledger → balance 0;
  `adjustPoints` creates a `manual_adjust` row with the right sign/admin; floor guard
  rejects an adjustment that would go below 0; `spendPoints` creates a `spend` row when
  balance ≥ cost and returns `{ ok: false }` (no row) when balance < cost.
- Route `/api/admin/points`: rejects non-admin (401), rejects zero/invalid delta (400),
  rejects a below-zero adjustment (400), creates a transaction and returns the updated
  balance on success.
- Agent gate (`process-job`): with balance < cost the AI client is not called, a "poin
  habis" message is sent, and the job completes without a spend row; with sufficient
  balance the reply is sent and exactly one `spend` row (`delta = -cost`) is created.

## Not doing (YAGNI)

- Cached balance column.
- Self-serve top-up flow and payment/checkout integration.
- Admin-configurable per-reply cost UI (cost is a constant/env for now).
- Metering beyond one point per agent reply (e.g. token-based cost, gating other
  AI surfaces like the metadata extension).
- Strict never-negative concurrency guarantee for agent spends (see AI spend + gate).
- Points on the users list table (only the detail header for now).
- Rupiah conversion / fixed rate.
