# Plan Point Revision — Free Becomes a Lifetime Trial

**Date:** 2026-07-29
**Status:** Approved

## Problem

Two things, one of them a gap that the previous points work missed.

**The allowances are wrong for the business.** They were sized on a guess — roughly 5 points per metadata generate and 21 per agent reply — and the owner has since decided on much smaller numbers. Free also has to come down, because the requested paid figures would otherwise make paying *worse*:

| | Free (current) | Pro (requested) | Result |
|---|---|---|---|
| Metadata | 500 | 500 | paying adds **nothing** |
| Agent | 1,000 | 600 | paying **removes** 400 points |

**Free metadata credits nothing at all.** `activateFreeMetadata` (`src/lib/orders.ts`) writes the license directly instead of going through `grantLicense`, so it never picked up the crediting added in `bf5e30f`. A Free metadata user gets an active license and an empty wallet, and the extension immediately reports "Poin habis" — the exact failure the paid path was just fixed to avoid.

Free agent is already correct: `activateFreeAgent` calls `creditPlanPoints` and its own comment notes the credit "cannot be farmed by re-submitting".

## Outcome

| | Free | Pro | Business |
|---|---|---|---|
| Metadata | **10**, lifetime | 500 | 1,000 |
| Agent | **15**, lifetime | 600 | 1,500 |

Free becomes a one-time trial. When it runs out the user upgrades; nothing tops it up again.

## Decisions

| Decision | Choice |
|---|---|
| Free semantics | Lifetime — once per account, ever |
| Paid semantics | Unchanged: credited on every activation and renewal |
| Lifetime marker | Existing `plan_grant` reason + note match, no migration |
| Marker location | One shared exported helper, used by the guard and the backfill |
| Free metadata | Starts crediting — currently credits nothing |
| Free agent | Gains the lifetime guard; "already active" is not enough |

## Architecture

### Free is lifetime, paid is per-period

These are two different rules living in one credit function, so the difference has to be visible in the code rather than implied by which call site you happen to be reading.

`creditPlanPoints` stays as it is — additive, no opinion about frequency. The *callers* decide:

- Paid activation (`grantLicense`, `activateAgentProfile`, `fulfillOrderRequest`'s agent branch) credits every time, which is what a monthly plan and its renewals mean.
- Free activation credits only if the account has never received a grant for that product.

### The lifetime marker, without a migration

`PointTransaction.reason` is already `"plan_grant"`, and the note reads `"{Bonus|Perpanjangan} paket {Product} {Plan}"`. So "has this account ever been granted for this product" is answerable with `reason: "plan_grant"` plus a note match on `"paket Metadata"` / `"paket Agent"`.

That depends on note wording, which the previous spec already flagged as a risk because the backfill script reads it too. So it gets centralised:

```ts
/**
 * Prisma filter matching every plan grant for one product. Both the lifetime
 * guard and scripts/backfill-metadata-plan-points.ts go through here, so the
 * dependency on note wording lives in exactly one place.
 */
export function planGrantFilter(product: PlanProduct): {
  reason: string;
  note: { contains: string };
};

/** True when this account has ever been credited for this product. */
export function hasEverReceivedPlanGrant(
  userId: string,
  product: PlanProduct
): Promise<boolean>;
```

The alternative — adding a `product` column to `PointTransaction` — is sturdier and was considered. It was rejected because it needs a migration plus a backfill of the column for existing rows, to remove a fragility that one shared function already contains. If the note format ever needs to change, `planGrantFilter` is the single thing to update, and its doc comment says so.

**This slightly changes the backfill, for the better.** `scripts/backfill-metadata-plan-points.ts` currently matches `note: { startsWith: "Bonus paket Metadata" }` — only initial grants, not renewals. Moving it onto `planGrantFilter` widens that to `contains: "paket Metadata"`, so an account whose only metadata grant was a renewal now counts as already granted instead of being credited again. That case is unlikely (a renewal normally follows an initial grant) but the wider match is the correct reading of "has this account ever been granted".

### Free credit call sites

`activateFreeMetadata` gains a credit after the license is written, guarded:

```ts
if (!(await hasEverReceivedPlanGrant(userId, "metadata"))) {
  await creditPlanPoints({ userId, product: "metadata", plan: "free" });
}
```

It goes **after** the existing `existing?.status === "active"` early return, so the ordinary re-submit path never reaches it.

`activateFreeAgent` gets the same guard around its existing `creditPlanPoints` call. Its current protection is the "profile already active" early return, which stops re-submitting but not this: revoke or disable the profile, activate Free again, and the allowance is granted a second time. For 15 points the money does not matter; calling it "lifetime" while that hole exists is what matters.

## Consequence for the marketing pages

**10 points is roughly 2–10 metadata generates.** Free is now a trial, not a tier anyone can work on.

`/pricing` currently reads *"Semua produk Nerona punya paket Free — mulai tanpa pembayaran, upgrade kapan saja."* Still literally true, but the marketing copy that follows this change must not imply ongoing free use — no "gratis selamanya", no "mulai gratis" without saying how far it goes. The honest framing is a trial with a stated size.

This is recorded here because the marketing work is a separate piece that depends on these numbers, and this is the constraint it inherits.

## Testing

- **`tests/lib/plan-points.test.ts`** — the eight assertions locking the old figures move to the new ones. New cases: `planGrantFilter` builds the expected filter per product; `hasEverReceivedPlanGrant` returns true when a matching row exists, false when the only rows belong to the other product, false when the ledger holds only `manual_adjust`/`spend`.
- **`tests/lib/orders.test.ts`** — the two `delta: 11_000` assertions become `600`. New cases: free metadata activation credits 10 exactly once and nothing on a second call; free agent activation credits 15 and is skipped when a prior agent grant exists.
- No new component tests — the codebase has none and Vitest runs in a node environment.

## Verification

1. `npm run build && npm test` — green.
2. A fresh account activates Free metadata → balance 10, one `Bonus paket Metadata Free` row.
3. Same account submits Free metadata again → balance still 10, no second row.
4. Revoke that license, activate Free again → **still** 10. This is the case the old guard missed.
5. Fresh account activates Free agent → balance 15, one row; repeat → still 15.
6. Activate a paid metadata Pro order → +500. Renew it → +500 again, noted as `Perpanjangan`. Paid is per-period, unlike Free.
7. Activate a paid agent Pro order → +600; Business → +1,500.
8. Pengaturan still overrides every figure — set Metadata Pro to 777, activate, get 777.
9. `npm run backfill:metadata-points` still reports correctly, since it now shares `planGrantFilter`.

## Risks

**Note wording is load-bearing.** `planGrantFilter` matches on the phrase `paket {Product}` inside the ledger note. Change the note format in `creditPlanPoints` and the lifetime guard silently stops recognising past grants — which would hand out Free points again to accounts that already had them. The filter and the note are built in the same file, a few lines apart, and both carry comments pointing at each other.

**Existing accounts keep whatever they have.** This changes what future activations grant; it does not adjust balances already credited under the old figures. The account backfilled earlier today holds 5,000 metadata points from the previous defaults. That is not a bug, but it means early accounts have far more than any new one will get, and the owner may want to level them with a manual adjustment.
