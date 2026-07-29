# Plan Point Allowances — Design

**Date:** 2026-07-29
**Status:** Approved

## Problem

Activating a metadata order gives the tenant an active license and an empty wallet.

`src/lib/orders.ts` `fulfillOrderRequest` credits points only in its `else` branch — the agent product. The `metadata` branch calls `grantLicense` and stops. But `src/app/api/extension/generate/route.ts:111` spends points on every extension generate, so a metadata tenant with no points cannot use the thing they just paid for. The code already names this failure mode in the agent branch: *"Without this the tenant has an active plan and an empty wallet, so the agent answers 'poin habis' to their very first message."* Metadata never got the same treatment.

Investigating it turned up two more holes with the same shape. The full picture of who credits points today:

| Path | Product | Credits? |
|---|---|---|
| `submitOrder` free activation (`orders.ts:78`) | agent | yes — 1,000 |
| `fulfillOrderRequest` agent branch | agent | yes |
| `fulfillOrderRequest` metadata branch | metadata | **no** |
| `activateAgentProfile` (admin manual) | agent | **no** |
| `grantLicense` (admin manual) | metadata | **no** |

Two further gaps, reported alongside:

- **Allowances are hardcoded.** `AGENT_PLAN_POINTS` in `src/lib/agent/plan-points.ts:15` is a literal map (free 1,000 / pro 11,000 / business 30,000). The owner cannot change it without a deploy, and metadata has no allowances at all.
- **The users list does not show points.** `AdminUsersDirectory` has columns Pengguna / Metadata / Agent / Terdaftar. To see a balance the owner must open each user's detail page.

**Already working, not part of this change:** manual point adjustment. `src/components/admin/UserFinancePanel.tsx` already adds and subtracts points with a required note via `/api/admin/points`, on the user detail page.

## Outcome

Every activation path credits the plan's allowance. The six allowance figures become editable in Pengaturan. The users list shows a balance column.

## Decisions

| Decision | Choice |
|---|---|
| Metadata allowance defaults | Free 500 / Pro 5,000 / Business 15,000 — sized to real cost, since a metadata generate runs ~1–5 points against ~21 for an agent reply |
| Agent allowance defaults | Unchanged: 1,000 / 11,000 / 30,000 |
| Storage | Six flat `Setting` keys, DB → env → code default |
| Where credit is applied | Explicitly at each activation site, not one chokepoint |
| Admin manual activation | Also credits. Accepted consequence: activating twice grants twice. Admins are trusted, every grant is a ledger row with a note, and the existing manual adjust can correct it. |
| Users list points | Display only. Editing stays in `UserFinancePanel`, which requires a note. |
| Existing empty wallets | One-off idempotent backfill script |

## Architecture

### Settings storage

Six keys, following the DB → env → code-default chain `src/lib/ai-settings.ts` already uses. Flat keys rather than one JSON blob, matching the existing style (`ai_price_in`, `points_per_usd`) and letting each value be overridden by its own env var.

| Setting key | Env override | Default |
|---|---|---|
| `points_plan_metadata_free` | `POINTS_PLAN_METADATA_FREE` | 500 |
| `points_plan_metadata_pro` | `POINTS_PLAN_METADATA_PRO` | 5,000 |
| `points_plan_metadata_business` | `POINTS_PLAN_METADATA_BUSINESS` | 15,000 |
| `points_plan_agent_free` | `POINTS_PLAN_AGENT_FREE` | 1,000 |
| `points_plan_agent_pro` | `POINTS_PLAN_AGENT_PRO` | 11,000 |
| `points_plan_agent_business` | `POINTS_PLAN_AGENT_BUSINESS` | 30,000 |

Validation reuses the rule `ai-settings.ts` established: a value counts only when it is a finite number ≥ 0. Blank, negative, or non-numeric falls through to the next source. **Zero is legitimate** — a plan with no allowance — and must not be treated as unset.

### `src/lib/plan-points.ts`

`src/lib/agent/plan-points.ts` **moves** to `src/lib/plan-points.ts`. It now serves both products, so `lib/agent/` is the wrong home. The move is cheap: `pointsForAgentPlan` and `AGENT_PLAN_POINTS` have no callers outside the module except `tests/lib/agent/plan-points.test.ts`.

```ts
export type PlanProduct = "metadata" | "agent";

export const DEFAULT_PLAN_POINTS: Record<PlanProduct, Record<string, number>> = {
  metadata: { free: 500, pro: 5_000, business: 15_000 },
  agent: { free: 1_000, pro: 11_000, business: 30_000 },
};

/** "Pro" → "pro". Metadata plans are stored capitalised, agent plans lowercase. */
export function normalizePlan(name: string): string;

/** DB → env → default. 0 for an unknown plan — never guess an allowance. */
export async function pointsForPlan(product: PlanProduct, plan: string): Promise<number>;

/** Credits the allowance and returns the amount (0 when the plan has none). */
export async function creditPlanPoints(params: {
  userId: string;
  product: PlanProduct;
  plan: string;
  createdById?: string | null;
  isRenewal?: boolean;
}): Promise<number>;
```

`normalizePlan` is load-bearing, not decoration. Metadata plans live in the `Plan` table as `"Free"` / `"Pro"` / `"Business"`; agent plans are stored lowercase, and `orders.ts` lowercases only in its agent branch. Without normalisation `pointsForPlan("metadata", "Pro")` returns 0 and the original bug reappears wearing a different hat.

`pointsForPlan` becomes async because it reads `Setting`. `creditPlanPoints` stays additive — the ledger is append-only, unused points carry over, and points a tenant bought separately are never destroyed.

### Where credit is applied

Only **two** new call sites are needed, because `grantLicense` has exactly two callers and both are metadata activation paths:

| Site | Covers | Change |
|---|---|---|
| `admin-grants.ts` `grantLicense` | both metadata paths — `fulfillOrderRequest` (`orders.ts:259`) and the manual grant in `/api/admin/licenses` | **add** credit after the license is written |
| `src/lib/agent/admin.ts` `activateAgentProfile` | manual agent activation | **add** credit after the upsert |
| `orders.ts` `fulfillOrderRequest` agent branch | agent order activation | already credits — only the rename to `creditPlanPoints({ product: "agent" })` |
| `orders.ts` `submitOrder` free path (line 78) | free agent signup | already credits — rename only |

**`fulfillOrderRequest`'s metadata branch gets no credit call of its own.** It calls `grantLicense`, which now credits, so adding one there would double every metadata activation. That is the single place this design can go wrong quietly, and it is what the once-only test guards.

A shared chokepoint for both products was considered and rejected: `fulfillOrderRequest`'s agent branch upserts `agentProfile` directly instead of calling `activateAgentProfile`, so routing everything through the two activation primitives would require refactoring that branch first — and double-crediting is exactly the risk that refactor would run.

`grantLicense` already has what it needs: it loads `plan` (so `normalizePlan(plan.name)`) and `user` (so `user.id`). It gains one option, `isRenewal?: boolean`, purely so the ledger note reads "Perpanjangan paket Pro" rather than "Bonus paket Pro" — `fulfillOrderRequest` already knows which it is and currently signals renewal only implicitly, by passing `validUntil`.

### Admin UI

**New panel `src/components/admin/AdminPlanPointsPanel.tsx`**, added to `(admin)/admin/pengaturan/page.tsx`. Two sections, Metadata and Agent, three number inputs each, plus the same "leave blank for default" affordance the other panels use. It cannot fold into `AdminPricingPanel`: that panel renders one row per `Plan` table row, and agent plans have no rows there.

Backed by a new `/api/admin/plan-points` route following the shape of `/api/admin/ai-settings` — GET returns raw stored values plus the effective figures after the fallback chain, POST writes them.

**Points column** in `AdminUsersDirectory`. `/api/admin/users` must return each user's balance. The table is `min-w-[720px]` inside an `overflow-x-auto` wrapper (`AdminUsersDirectory.tsx:179-180`); a seventh column needs that minimum raised, or the columns compress instead of scrolling.

### Backfill

A one-off script granting metadata allowances to tenants who activated before this change. For every user holding an `active` or `comp` license with no metadata `plan_grant` row, credit their plan's allowance.

Idempotent by construction: the presence of a metadata `plan_grant` is the marker, so a second run credits nobody. It writes ordinary ledger rows, so the result is visible and auditable in `UserFinancePanel` like any other grant.

## Testing

- **`tests/lib/plan-points.test.ts`** (moved from `tests/lib/agent/`, extended) — the DB → env → default chain for both products; zero honoured as a real allowance; negative and non-numeric rejected; `normalizePlan` handling the metadata capitalisation; `pointsForPlan` returning 0 for an unknown plan.
- **`tests/lib/orders.test.ts`** (extended) — fulfilling a metadata order credits the allowance exactly once. This is the regression that started this work, and the once-only assertion guards the `grantLicense`-also-credits overlap.
- **Agent activation** — `activateAgentProfile` credits on manual activation, and a manual metadata grant through `/api/admin/licenses` credits too.
- No component tests: `vitest.config.ts` runs a node environment with `include: ["tests/**/*.test.ts"]`, and the codebase has no component tests.

## Verification

1. `npm run build` — succeeds.
2. `npm test` — all suites green.
3. Owner activates a pending **metadata** order → the tenant's balance rises by that plan's allowance, and Finance shows a `plan_grant` row.
4. Owner activates a pending **agent** order → unchanged behaviour, credited once.
5. Owner grants a metadata license manually from the user detail page → allowance credited.
6. Pengaturan → change Metadata Pro to a different number → activate a Pro order → the new number is credited.
7. Set an allowance to `0` → activation credits nothing and writes no ledger row.
8. Clear an allowance to blank → the code default returns.
9. Users list shows a points column matching each user's detail-page balance, and the table still scrolls rather than compressing at ~1024px.
10. Run the backfill twice — the second run credits nobody.

## Risks

**Double-crediting.** `fulfillOrderRequest`'s metadata branch calls `grantLicense`, which will now credit. Adding a credit to the branch as well would silently double every metadata activation. The once-only test in `orders.test.ts` exists specifically to catch this.

**Plan-name casing.** Every allowance lookup must go through `normalizePlan`. A raw `"Pro"` returns 0, which fails silently — no error, just no points, which is the original bug.
