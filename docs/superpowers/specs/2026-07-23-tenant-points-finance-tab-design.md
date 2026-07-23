# Tenant Points & Finance Tab — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)

## Summary

On the admin user detail page (`/admin/users/[id]`), show a **points balance** for
the tenant owner and add a **Finance tab** that lists what the tenant has bought on
Nerona (plan activations such as Pro/Business) alongside their point transactions.

Points are a **prepaid credit wallet** (money in via top-up, spent on Nerona services
later). In this first build the balance changes only through **admin manual
adjustments**. Points are an **abstract count** (displayed as e.g. "1.250 poin") with
no fixed rupiah conversion yet.

Out of scope for this build (but the model must support them without migration):
self-serve top-up and automatic usage deduction.

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
  reason      String   // "manual_adjust" (future: "topup" | "spend")
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
- A guard MAY reject adjustments that would drive the balance negative — decided at
  implementation time; default is to allow (admin correction of over-spend).

### Read
The detail page loads server-side (it is already an async server component):
- `balance` — `prisma.pointTransaction.aggregate({ _sum: { delta }, where: { userId } })`.
- `transactions` — recent `PointTransaction`s (newest first, capped, with `createdBy` name).
- `purchases` — unified list, newest first:
  - fulfilled `OrderRequest`s → `{ kind: "plan", product, planName, date: fulfilledAt }`
  - `Order`s → `{ kind: "order", amount, currency, note, courseId, date: createdAt }`

Helper functions live in a new `src/lib/points.ts` (`getBalance`, `adjustPoints`,
`listTransactions`) so the route and page share one source of truth, mirroring
`lib/admin-grants.ts`.

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
- User not found → 404.
- Balance aggregate over zero rows → treat null sum as `0`.

## Testing

- Unit (vitest) for `lib/points.ts`: balance = sum of deltas; adjust creates a row with
  the right sign/reason/admin; empty ledger → balance 0.
- Route: rejects non-admin, rejects zero/invalid delta, creates transaction and returns
  updated balance.

## Not doing (YAGNI)

- Cached balance column.
- Self-serve top-up flow and payment integration.
- Automatic usage deduction / metering.
- Points on the users list table (only the detail header for now).
- Rupiah conversion / fixed rate.
