# Plan Point Allowances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every plan activation credit the tenant's point allowance, make the six allowance figures editable in Pengaturan, and show each user's balance in the admin users list.

**Architecture:** `src/lib/agent/plan-points.ts` moves up to `src/lib/plan-points.ts` and becomes product-aware, reading allowances from the `Setting` table through the DB → env → code-default chain `ai-settings.ts` already established. Credit is added at exactly two sites — `grantLicense` (which covers both metadata paths) and `activateAgentProfile` — because those are the primitives that make a plan active.

**Tech Stack:** Next.js 14.2 (App Router), TypeScript, Prisma, Vitest — all existing, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-29-plan-points-design.md`

## Global Constraints

- **Metadata defaults: Free 500 / Pro 5,000 / Business 15,000.** Agent defaults unchanged: 1,000 / 11,000 / 30,000.
- **Zero is a legitimate allowance**, meaning "this plan grants nothing". It must never be treated as unset. Only blank, negative, and non-numeric fall through to the next source in the chain.
- **Every allowance lookup goes through `normalizePlan`.** Metadata plans are stored capitalised in the `Plan` table (`"Free"`, `"Pro"`, `"Business"`, see `prisma/seed.ts`); agent plans are stored lowercase. A raw `"Pro"` returns 0 and grants nothing, with no error — that is the original bug in a new costume.
- **`fulfillOrderRequest`'s metadata branch must NOT get its own credit call.** It calls `grantLicense`, which credits. Adding one there doubles every metadata activation.
- **There is no lint gate.** ESLint is neither installed nor configured; `npm run lint` only opens Next's interactive setup wizard. `npm run build` is the type gate — Next runs `tsc` inside it.
- **Tests are `.ts` only, node environment** (`vitest.config.ts`: `include: ["tests/**/*.test.ts"]`, `environment: "node"`). No component tests — the codebase has none.
- **Copy is Indonesian.** Ledger notes, panel labels, and error messages follow the existing wording.
- **Commit after every task.**

---

### Task 1: `src/lib/plan-points.ts` — product-aware, Setting-backed allowances

**Files:**
- Create: `src/lib/plan-points.ts`
- Delete: `src/lib/agent/plan-points.ts`
- Create: `tests/lib/plan-points.test.ts`
- Delete: `tests/lib/agent/plan-points.test.ts`
- Modify: `src/lib/orders.ts:5` (import), `:78` and the agent branch of `fulfillOrderRequest` (call sites)

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces, used by Tasks 2, 3, and 6:
  - `type PlanProduct = "metadata" | "agent"`
  - `DEFAULT_PLAN_POINTS: Record<PlanProduct, Record<string, number>>`
  - `normalizePlan(name: string): string`
  - `settingKey(product: PlanProduct, plan: string): string`
  - `pointsForPlan(product: PlanProduct, plan: string): Promise<number>`
  - `creditPlanPoints(params: { userId: string; product: PlanProduct; plan: string; createdById?: string | null; isRenewal?: boolean }): Promise<number>`

`pointsForAgentPlan` and `AGENT_PLAN_POINTS` are **removed**, not wrapped. Their only consumers outside the module are the old test file, which this task replaces.

Note the ledger note changes shape. It was `"Bonus paket Pro"`; it becomes `"Bonus paket Agent Pro"`. Both products have plans named Free/Pro/Business, so without the product name a ledger row is ambiguous the moment metadata starts granting.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/plan-points.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    pointTransaction: { create: vi.fn() },
  },
}));

import {
  DEFAULT_PLAN_POINTS,
  creditPlanPoints,
  normalizePlan,
  pointsForPlan,
  settingKey,
} from "@/lib/plan-points";
import { prisma } from "@/lib/prisma";

/** No Setting row stored — the chain falls through to env or the default. */
function noStoredValue() {
  (prisma.setting.findUnique as any).mockResolvedValue(null);
}

function storedValue(value: string) {
  (prisma.setting.findUnique as any).mockResolvedValue({ key: "k", value });
}

describe("normalizePlan", () => {
  it("folds the metadata table's capitalisation to the agent convention", () => {
    // Plan rows are seeded as "Free"/"Pro"/"Business"; agent plans are lowercase.
    expect(normalizePlan("Pro")).toBe("pro");
    expect(normalizePlan("  Business ")).toBe("business");
    expect(normalizePlan("free")).toBe("free");
  });
});

describe("settingKey", () => {
  it("builds one flat key per product and plan", () => {
    expect(settingKey("metadata", "Pro")).toBe("points_plan_metadata_pro");
    expect(settingKey("agent", "business")).toBe("points_plan_agent_business");
  });
});

describe("DEFAULT_PLAN_POINTS", () => {
  it("keeps the agent allowances that are already in production", () => {
    expect(DEFAULT_PLAN_POINTS.agent).toEqual({ free: 1_000, pro: 11_000, business: 30_000 });
  });

  it("sizes metadata to real cost, below agent's per-call price", () => {
    expect(DEFAULT_PLAN_POINTS.metadata).toEqual({ free: 500, pro: 5_000, business: 15_000 });
  });

  it("never ships a negative or fractional allowance", () => {
    for (const plans of Object.values(DEFAULT_PLAN_POINTS)) {
      for (const amount of Object.values(plans)) {
        expect(Number.isInteger(amount)).toBe(true);
        expect(amount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("pointsForPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POINTS_PLAN_METADATA_PRO;
  });

  it("falls back to the code default when nothing is stored", async () => {
    noStoredValue();
    expect(await pointsForPlan("metadata", "pro")).toBe(5_000);
    expect(await pointsForPlan("agent", "free")).toBe(1_000);
  });

  it("accepts the metadata table's capitalisation", async () => {
    noStoredValue();
    expect(await pointsForPlan("metadata", "Pro")).toBe(5_000);
    expect(await pointsForPlan("metadata", "Business")).toBe(15_000);
  });

  it("prefers a stored value over the default", async () => {
    storedValue("777");
    expect(await pointsForPlan("metadata", "pro")).toBe(777);
  });

  it("honours a stored zero as a real allowance of nothing", async () => {
    storedValue("0");
    expect(await pointsForPlan("metadata", "pro")).toBe(0);
  });

  it("falls through to env when nothing is stored", async () => {
    noStoredValue();
    process.env.POINTS_PLAN_METADATA_PRO = "2500";
    expect(await pointsForPlan("metadata", "pro")).toBe(2_500);
  });

  it("ignores stored junk rather than granting a broken amount", async () => {
    for (const junk of ["", "   ", "-5", "abc", "1.5"]) {
      storedValue(junk);
      expect(await pointsForPlan("metadata", "pro")).toBe(5_000);
    }
  });

  it("grants nothing for an unknown plan rather than guessing", async () => {
    noStoredValue();
    expect(await pointsForPlan("agent", "enterprise")).toBe(0);
    expect(await pointsForPlan("metadata", "")).toBe(0);
  });

  it("does not query Setting for a plan that has no allowance at all", async () => {
    noStoredValue();
    await pointsForPlan("agent", "enterprise");
    expect(prisma.setting.findUnique).not.toHaveBeenCalled();
  });
});

describe("creditPlanPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noStoredValue();
  });

  it("credits the allowance and names the product in the ledger", async () => {
    // Both products have a "Pro"; the note has to say which one.
    const credited = await creditPlanPoints({
      userId: "user-1",
      product: "agent",
      plan: "pro",
      createdById: "admin-1",
    });

    expect(credited).toBe(11_000);
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        delta: 11_000,
        reason: "plan_grant",
        note: "Bonus paket Agent Pro",
        createdById: "admin-1",
      },
    });
  });

  it("labels a renewal so the ledger distinguishes it", async () => {
    await creditPlanPoints({
      userId: "user-1",
      product: "metadata",
      plan: "Business",
      createdById: "admin-1",
      isRenewal: true,
    });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: 15_000,
          note: "Perpanjangan paket Metadata Business",
        }),
      })
    );
  });

  it("allows a self-service activation with no admin attached", async () => {
    await creditPlanPoints({ userId: "user-1", product: "agent", plan: "free" });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: 1_000, createdById: null }),
      })
    );
  });

  it("writes nothing for an unknown plan", async () => {
    const credited = await creditPlanPoints({ userId: "user-1", product: "agent", plan: "mystery" });

    expect(credited).toBe(0);
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });

  it("writes nothing when the allowance is configured to zero", async () => {
    storedValue("0");
    const credited = await creditPlanPoints({ userId: "user-1", product: "metadata", plan: "pro" });

    expect(credited).toBe(0);
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/plan-points.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan-points'`.

- [ ] **Step 3: Create `src/lib/plan-points.ts`**

```ts
import { prisma } from "@/lib/prisma";

export type PlanProduct = "metadata" | "agent";

/**
 * Points granted when a plan is activated or renewed.
 *
 * Agent figures cover each plan's monthly message cap in agent/limits.ts
 * (free 50, pro 500) at roughly 21 points per reply. Business has no message
 * cap, so its allowance is a deliberate ceiling (~1,400 replies) that still
 * meters runaway use.
 *
 * Metadata figures answer the same monthly quotas in prisma/seed.ts (free 50,
 * pro 500 generates, business unlimited), but an extension generate costs far
 * less than an agent reply — roughly 1-5 points against ~21 — so the
 * allowances are correspondingly smaller.
 *
 * Both gates stay independent by design: a tenant must be under their quota
 * AND hold points.
 *
 * These are defaults only. The owner overrides them per plan in Pengaturan;
 * see pointsForPlan for the resolution order.
 */
export const DEFAULT_PLAN_POINTS: Record<PlanProduct, Record<string, number>> = {
  metadata: { free: 500, pro: 5_000, business: 15_000 },
  agent: { free: 1_000, pro: 11_000, business: 30_000 },
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const PRODUCT_LABELS: Record<PlanProduct, string> = {
  metadata: "Metadata",
  agent: "Agent",
};

/**
 * Metadata plans live in the Plan table capitalised ("Pro"); agent plans are
 * stored lowercase. Every allowance lookup goes through here — a raw "Pro"
 * would resolve to no allowance and grant nothing, silently.
 */
export function normalizePlan(name: string): string {
  return name.trim().toLowerCase();
}

/** One flat Setting key per product and plan, matching the ai_* key style. */
export function settingKey(product: PlanProduct, plan: string): string {
  return `points_plan_${product}_${normalizePlan(plan)}`;
}

function envKey(product: PlanProduct, plan: string): string {
  return `POINTS_PLAN_${product.toUpperCase()}_${normalizePlan(plan).toUpperCase()}`;
}

/**
 * An allowance counts only when it is a finite integer >= 0 — the same rule
 * ai-settings.ts applies to rates. Blank, negative, and non-numeric are treated
 * as unset so the next source in the chain applies.
 *
 * Zero is legitimate: a plan that grants nothing. It must not read as unset.
 */
function parseAllowance(raw: string | undefined): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** DB → env → code default. 0 for an unknown plan — never guess an allowance. */
export async function pointsForPlan(product: PlanProduct, plan: string): Promise<number> {
  const key = normalizePlan(plan);
  const fallback = DEFAULT_PLAN_POINTS[product]?.[key];
  // An unknown plan has no allowance to configure, so there is nothing to read.
  if (fallback === undefined) return 0;

  const row = await prisma.setting.findUnique({ where: { key: settingKey(product, key) } });
  return (
    parseAllowance(row?.value) ?? parseAllowance(process.env[envKey(product, key)]) ?? fallback
  );
}

/**
 * Credits a plan's allowance to the tenant's wallet. Additive on purpose: the
 * ledger is append-only, unused points carry over, and points the tenant bought
 * separately are never destroyed.
 *
 * Returns the amount credited (0 when the plan has no allowance).
 */
export async function creditPlanPoints(params: {
  userId: string;
  product: PlanProduct;
  plan: string;
  createdById?: string | null;
  isRenewal?: boolean;
}): Promise<number> {
  const plan = normalizePlan(params.plan);
  const amount = await pointsForPlan(params.product, plan);
  if (amount <= 0) return 0;

  // The product belongs in the note: both products have a Free, Pro, and
  // Business, so "Bonus paket Pro" alone does not say which wallet grew.
  const label = `${PRODUCT_LABELS[params.product]} ${PLAN_LABELS[plan] ?? plan}`;
  await prisma.pointTransaction.create({
    data: {
      userId: params.userId,
      delta: amount,
      reason: "plan_grant",
      note: `${params.isRenewal ? "Perpanjangan" : "Bonus"} paket ${label}`,
      createdById: params.createdById ?? null,
    },
  });

  return amount;
}
```

- [ ] **Step 4: Delete the old module and its test**

```bash
cd nerona-web
git rm src/lib/agent/plan-points.ts tests/lib/agent/plan-points.test.ts
```

- [ ] **Step 5: Update the two call sites in `src/lib/orders.ts`**

Change the import at line 5:

```ts
import { creditPlanPoints } from "@/lib/plan-points";
```

At line 78 (the free agent signup path in `submitOrder`):

```ts
  await creditPlanPoints({ userId, product: "agent", plan: "free" });
```

In `fulfillOrderRequest`'s agent branch, replace the `creditAgentPlanPoints` call:

```ts
    await creditPlanPoints({
      userId: order.user.id,
      product: "agent",
      plan,
      createdById: adminId,
      isRenewal: Boolean(order.isRenewal),
    });
```

Leave the metadata branch alone — Task 2 makes `grantLicense` credit, and a call here as well would double it.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd nerona-web && npx vitest run tests/lib/plan-points.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Fix `tests/lib/orders.test.ts` — it will break, in two known ways**

That file does not mock the plan-points module; it exercises the real credit function against a mocked prisma and asserts the exact `pointTransaction.create` payload. Two things therefore break:

1. Real `creditPlanPoints` now calls `prisma.setting.findUnique`, which is absent from the file's prisma mock → `TypeError: Cannot read properties of undefined (reading 'findUnique')`.
2. The ledger note gains the product name.

Add `setting` to the prisma mock block at the top of the file (returning `null` so the code default applies):

```ts
    setting: { findUnique: vi.fn(async () => null) },
```

Then update the two note assertions:

- line 198: `note: "Bonus paket Pro"` → `note: "Bonus paket Agent Pro"`
- line 219: `note: "Perpanjangan paket Pro"` → `note: "Perpanjangan paket Agent Pro"`

Keep the real module unmocked — asserting the actual ledger row is the value these tests carry.

- [ ] **Step 8: Build and run the whole suite**

Run: `cd nerona-web && npm run build && npm test`
Expected: both pass.

- [ ] **Step 9: Commit**

```bash
cd nerona-web
git add -A src/lib tests/lib
git commit -m "refactor: make plan point allowances product-aware and configurable

Moves agent/plan-points.ts up to lib/plan-points.ts — it now serves both
products, so lib/agent/ was the wrong home. Allowances resolve DB -> env ->
code default, the chain ai-settings.ts already uses, so the owner can tune
them without a deploy.

Ledger notes gain the product name: both products have a Free, Pro, and
Business, so \"Bonus paket Pro\" did not say which wallet grew."
```

---

### Task 2: Credit points wherever a plan becomes active

This is the bug the work started from. Two sites gain a credit call; `grantLicense` covers both metadata paths because its only callers are `fulfillOrderRequest` and the manual grant route.

**Files:**
- Modify: `src/lib/admin-grants.ts` — `GrantOptions` gains `isRenewal`; `grantLicense` credits after writing the license
- Modify: `src/lib/agent/admin.ts` — `activateAgentProfile` credits after the upsert
- Modify: `src/lib/orders.ts` — `fulfillOrderRequest` passes `isRenewal` to `grantLicense`
- Modify: `tests/lib/orders.test.ts` — add the once-only metadata assertion
- Create: `tests/lib/admin-grants-points.test.ts`

**Interfaces:**
- Consumes: `creditPlanPoints` from `@/lib/plan-points` (Task 1).
- Produces: no new exported symbols. `GrantOptions` gains an optional `isRenewal?: boolean`.

- [ ] **Step 1: Write the failing test for the grant path**

Create `tests/lib/admin-grants-points.test.ts`. It covers `grantLicense` only; the existing `tests/lib/admin-grants.test.ts` keeps its own concerns.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const creditPlanPointsMock = vi.fn(async () => 5_000);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    license: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    order: { create: vi.fn() },
  },
}));
vi.mock("@/lib/license", () => ({ generateLicenseKey: vi.fn(async () => "KEY-1") }));
vi.mock("@/lib/plan-points", () => ({
  creditPlanPoints: (...args: unknown[]) => creditPlanPointsMock(...(args as [])),
}));

import { grantLicense } from "@/lib/admin-grants";
import { prisma } from "@/lib/prisma";

function happyPath() {
  (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "t@example.com" });
  (prisma.plan.findUnique as any).mockResolvedValue({
    id: "plan-pro",
    name: "Pro",
    marketplaces: "*",
    rejectAnalyzer: false,
  });
  (prisma.license.findFirst as any).mockResolvedValue(null);
}

describe("grantLicense point allowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditPlanPointsMock.mockResolvedValue(5_000);
  });

  it("credits the metadata allowance so the tenant is not left with an empty wallet", async () => {
    happyPath();

    const result = await grantLicense("admin-1", "t@example.com", "plan-pro");

    expect(result).toEqual({ ok: true });
    expect(creditPlanPointsMock).toHaveBeenCalledWith({
      userId: "user-1",
      product: "metadata",
      // The Plan table stores "Pro"; creditPlanPoints normalises it.
      plan: "Pro",
      createdById: "admin-1",
      isRenewal: false,
    });
  });

  it("labels a renewal when the caller says so", async () => {
    happyPath();

    await grantLicense("admin-1", "t@example.com", "plan-pro", { isRenewal: true });

    expect(creditPlanPointsMock).toHaveBeenCalledWith(
      expect.objectContaining({ isRenewal: true })
    );
  });

  it("credits nothing when the user does not exist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await grantLicense("admin-1", "nobody@example.com", "plan-pro");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
    expect(creditPlanPointsMock).not.toHaveBeenCalled();
  });

  it("credits nothing when the plan does not exist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "t@example.com" });
    (prisma.plan.findUnique as any).mockResolvedValue(null);

    const result = await grantLicense("admin-1", "t@example.com", "missing");

    expect(result).toEqual({ ok: false, reason: "plan_not_found" });
    expect(creditPlanPointsMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/admin-grants-points.test.ts`
Expected: FAIL — `creditPlanPointsMock` was never called.

- [ ] **Step 3: Make `grantLicense` credit**

In `src/lib/admin-grants.ts`, add the import:

```ts
import { creditPlanPoints } from "@/lib/plan-points";
```

Add the option to `GrantOptions`:

```ts
export interface GrantOptions {
  note?: string;
  amount?: number;
  currency?: string;
  validUntil?: Date;
  /** Only changes the ledger note ("Perpanjangan" vs "Bonus"). */
  isRenewal?: boolean;
}
```

Then, immediately before the closing `return { ok: true };`, after the optional `order.create` block:

```ts
  // A metadata license without points is useless: api/extension/generate spends
  // points on every call, so activating a plan and granting no allowance leaves
  // the tenant unable to use what they just paid for. Both metadata activation
  // paths — order fulfilment and this manual grant — land here.
  await creditPlanPoints({
    userId: user.id,
    product: "metadata",
    plan: plan.name,
    createdById: adminId,
    isRenewal: Boolean(options.isRenewal),
  });

  return { ok: true };
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd nerona-web && npx vitest run tests/lib/admin-grants-points.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 5: Write the failing once-only test for order fulfilment**

Add to `tests/lib/orders.test.ts`. This guards the constraint that the metadata branch must not credit on top of `grantLicense`.

No new mock is needed. `grantLicense` is already mocked in that file, so it credits nothing during the test — which means any `pointTransaction.create` call that does happen came from the metadata branch itself. That is exactly the failure being guarded, so asserting on prisma directly is both simpler and more direct than mocking the credit function.

```ts
describe("fulfillOrderRequest — metadata points", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves crediting to grantLicense so the allowance is not doubled", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-1",
      status: "pending",
      product: "metadata",
      planName: "Pro",
      isRenewal: false,
      user: { id: "user-1", email: "t@example.com" },
    });
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-pro", name: "Pro" });
    (grantLicense as any).mockResolvedValue({ ok: true });

    const result = await fulfillOrderRequest("admin-1", "req-1");

    expect(result).toEqual({ ok: true });
    // grantLicense is mocked here, so it credits nothing. Any ledger write that
    // shows up came from the metadata branch — which would double the allowance
    // in production, where grantLicense does credit.
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    expect(grantLicense).toHaveBeenCalledWith(
      "admin-1",
      "t@example.com",
      "plan-pro",
      expect.objectContaining({ isRenewal: false })
    );
  });
});
```

- [ ] **Step 6: Run it and pass it by threading `isRenewal` through**

Run: `cd nerona-web && npx vitest run tests/lib/orders.test.ts`
Expected: FAIL — `grantLicense` was called without `isRenewal`.

In `src/lib/orders.ts`, `fulfillOrderRequest`'s metadata branch, add `isRenewal` to the options already being passed:

```ts
    const result = await grantLicense(adminId, order.user.email, plan.id, {
      note: `Order ${order.id}`,
      validUntil,
      isRenewal: Boolean(order.isRenewal),
    });
```

Rerun the same command. Expected: PASS.

- [ ] **Step 7: Make manual agent activation credit**

In `src/lib/agent/admin.ts`, add the import:

```ts
import { creditPlanPoints } from "@/lib/plan-points";
```

In `activateAgentProfile`, replace the final `return { ok: true };` with:

```ts
  // Same reasoning as the metadata grant: an active plan with an empty wallet
  // makes the agent answer "poin habis" to the tenant's first message. Only
  // credit when a plan was actually named — a bare reactivation keeps whatever
  // plan the profile already had, and its allowance was granted then.
  if (plan) {
    await creditPlanPoints({
      userId: user.id,
      product: "agent",
      plan,
      createdById: null,
    });
  }

  return { ok: true };
```

`activateAgentProfile` does not receive an admin id, so `createdById` is null — the ledger note still records what happened, and the existing `/api/admin/agent` route is admin-only.

- [ ] **Step 8: Build and run the whole suite**

Run: `cd nerona-web && npm run build && npm test`
Expected: both pass. If `tests/lib/agent/admin.test.ts` fails because `activateAgentProfile` now calls into `plan-points`, add the same `@/lib/plan-points` mock to that file's mock block.

- [ ] **Step 9: Commit**

```bash
cd nerona-web
git add -A src/lib tests/lib
git commit -m "fix: credit the point allowance wherever a plan becomes active

Activating a metadata order left the tenant with an active license and an
empty wallet — fulfillOrderRequest credited only in its agent branch, while
api/extension/generate spends points on every call.

Crediting inside grantLicense closes both metadata paths at once, since its
only callers are order fulfilment and the manual admin grant. Manual agent
activation had the same hole and is fixed alongside.

fulfillOrderRequest's metadata branch deliberately does NOT credit: it calls
grantLicense, so a call there would double every activation. A test pins it."
```

---

### Task 3: Read and write allowances — view, update, and API route

**Files:**
- Modify: `src/lib/plan-points.ts` — add `getPlanPointsView` and `updatePlanPoints`
- Create: `src/app/api/admin/plan-points/route.ts`
- Modify: `tests/lib/plan-points.test.ts` — cover the view and update
- Create: `tests/lib/plan-points-route.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_PLAN_POINTS`, `settingKey`, `normalizePlan`, `pointsForPlan` from Task 1.
- Produces, used by Task 4:
  - `interface PlanPointsRow { product: PlanProduct; plan: string; label: string; stored: string; effective: number }`
  - `getPlanPointsView(): Promise<PlanPointsRow[]>`
  - `updatePlanPoints(values: Array<{ product: PlanProduct; plan: string; value: string }>): Promise<void>`
  - `GET /api/admin/plan-points` → `{ ok: true, rows: PlanPointsRow[] }`
  - `POST /api/admin/plan-points` with `{ rows: Array<{ product, plan, value }> }` → `{ ok: true }`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/plan-points.test.ts`. The prisma mock from Step 1 of Task 1 needs two more methods, so update its `vi.mock` block to:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    pointTransaction: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
```

and add `getPlanPointsView, updatePlanPoints` to the import list. Then:

```ts
describe("getPlanPointsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POINTS_PLAN_METADATA_PRO;
  });

  it("returns one row per product and plan, with stored blank when unset", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);

    const rows = await getPlanPointsView();

    expect(rows).toHaveLength(6);
    const metaPro = rows.find((r) => r.product === "metadata" && r.plan === "pro");
    expect(metaPro).toEqual({
      product: "metadata",
      plan: "pro",
      label: "Pro",
      stored: "",
      effective: 5_000,
    });
  });

  it("reports the stored value and the effective figure separately", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: "points_plan_metadata_pro", value: "777" },
    ]);

    const rows = await getPlanPointsView();
    const metaPro = rows.find((r) => r.product === "metadata" && r.plan === "pro");

    expect(metaPro?.stored).toBe("777");
    expect(metaPro?.effective).toBe(777);
  });

  it("shows the effective figure coming from env while stored stays blank", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);
    process.env.POINTS_PLAN_METADATA_PRO = "2500";

    const rows = await getPlanPointsView();
    const metaPro = rows.find((r) => r.product === "metadata" && r.plan === "pro");

    expect(metaPro?.stored).toBe("");
    expect(metaPro?.effective).toBe(2_500);
  });
});

describe("updatePlanPoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes one Setting row per value in a single transaction", async () => {
    await updatePlanPoints([
      { product: "metadata", plan: "pro", value: "777" },
      { product: "agent", plan: "free", value: "" },
    ]);

    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: "points_plan_metadata_pro" },
      create: { key: "points_plan_metadata_pro", value: "777" },
      update: { value: "777" },
    });
    // "" is a deliberate clear back to the env/default fallback, not a no-op.
    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: "points_plan_agent_free" },
      create: { key: "points_plan_agent_free", value: "" },
      update: { value: "" },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("ignores a product or plan that has no allowance to configure", async () => {
    await updatePlanPoints([{ product: "agent", plan: "enterprise", value: "10" }]);

    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/plan-points.test.ts`
Expected: FAIL — `getPlanPointsView is not a function`.

- [ ] **Step 3: Add the view and update functions to `src/lib/plan-points.ts`**

```ts
export interface PlanPointsRow {
  product: PlanProduct;
  plan: string;
  /** Display label, e.g. "Pro". */
  label: string;
  /** Raw stored value — "" when unset, so the panel can show a placeholder. */
  stored: string;
  /** What is actually in force after DB → env → default. */
  effective: number;
}

/** Every (product, plan) pair that has an allowance, in display order. */
function allPairs(): Array<{ product: PlanProduct; plan: string }> {
  const products: PlanProduct[] = ["metadata", "agent"];
  return products.flatMap((product) =>
    Object.keys(DEFAULT_PLAN_POINTS[product]).map((plan) => ({ product, plan }))
  );
}

export async function getPlanPointsView(): Promise<PlanPointsRow[]> {
  const pairs = allPairs();
  const rows = await prisma.setting.findMany({
    where: { key: { in: pairs.map((p) => settingKey(p.product, p.plan)) } },
  });
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  return pairs.map(({ product, plan }) => {
    const raw = stored.get(settingKey(product, plan)) ?? "";
    const effective =
      parseAllowance(raw) ??
      parseAllowance(process.env[envKey(product, plan)]) ??
      DEFAULT_PLAN_POINTS[product][plan];
    return { product, plan, label: PLAN_LABELS[plan] ?? plan, stored: raw.trim(), effective };
  });
}

export async function updatePlanPoints(
  values: Array<{ product: PlanProduct; plan: string; value: string }>
): Promise<void> {
  const ops = [];
  for (const { product, plan, value } of values) {
    // Silently skip anything with no allowance to configure — a caller cannot
    // invent a plan by POSTing one.
    if (DEFAULT_PLAN_POINTS[product]?.[normalizePlan(plan)] === undefined) continue;
    const key = settingKey(product, plan);
    const trimmed = value.trim();
    ops.push(
      prisma.setting.upsert({
        where: { key },
        create: { key, value: trimmed },
        update: { value: trimmed },
      })
    );
  }
  if (ops.length === 0) return;
  await prisma.$transaction(ops);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd nerona-web && npx vitest run tests/lib/plan-points.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Write the failing route test**

Create `tests/lib/plan-points-route.test.ts`, following the shape of the existing `tests/lib/ai-settings-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const getPlanPointsViewMock = vi.fn();
const updatePlanPointsMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/plan-points", () => ({
  getPlanPointsView: () => getPlanPointsViewMock(),
  updatePlanPoints: (...args: unknown[]) => updatePlanPointsMock(...(args as [])),
}));

import { GET, POST } from "@/app/api/admin/plan-points/route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/admin/plan-points", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/plan-points", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a caller with no admin role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(getPlanPointsViewMock).not.toHaveBeenCalled();
  });

  it("returns the rows for an admin", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    getPlanPointsViewMock.mockResolvedValue([
      { product: "metadata", plan: "pro", label: "Pro", stored: "", effective: 5_000 },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      rows: [{ product: "metadata", plan: "pro", label: "Pro", stored: "", effective: 5_000 }],
    });
  });
});

describe("POST /api/admin/plan-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
  });

  it("refuses a caller with no admin role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    const res = await POST(post({ rows: [] }));

    expect(res.status).toBe(401);
    expect(updatePlanPointsMock).not.toHaveBeenCalled();
  });

  it("stores valid rows", async () => {
    const res = await POST(
      post({ rows: [{ product: "metadata", plan: "pro", value: "777" }] })
    );

    expect(res.status).toBe(200);
    expect(updatePlanPointsMock).toHaveBeenCalledWith([
      { product: "metadata", plan: "pro", value: "777" },
    ]);
  });

  it("accepts a blank value as a clear back to the default", async () => {
    const res = await POST(post({ rows: [{ product: "metadata", plan: "pro", value: "" }] }));

    expect(res.status).toBe(200);
    expect(updatePlanPointsMock).toHaveBeenCalledWith([
      { product: "metadata", plan: "pro", value: "" },
    ]);
  });

  it("accepts zero as a real allowance of nothing", async () => {
    const res = await POST(post({ rows: [{ product: "metadata", plan: "pro", value: "0" }] }));

    expect(res.status).toBe(200);
  });

  it("rejects a negative or fractional allowance", async () => {
    for (const bad of ["-1", "1.5", "abc"]) {
      vi.clearAllMocks();
      const res = await POST(post({ rows: [{ product: "metadata", plan: "pro", value: bad }] }));

      expect(res.status).toBe(400);
      expect(updatePlanPointsMock).not.toHaveBeenCalled();
    }
  });

  it("rejects an unknown product", async () => {
    const res = await POST(post({ rows: [{ product: "courses", plan: "pro", value: "1" }] }));

    expect(res.status).toBe(400);
    expect(updatePlanPointsMock).not.toHaveBeenCalled();
  });

  it("rejects a body that is not shaped like rows", async () => {
    const res = await POST(post({ rows: "nope" }));

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/plan-points-route.test.ts`
Expected: FAIL — cannot resolve `@/app/api/admin/plan-points/route`.

- [ ] **Step 7: Create `src/app/api/admin/plan-points/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPlanPointsView, updatePlanPoints, type PlanProduct } from "@/lib/plan-points";

const PRODUCTS: PlanProduct[] = ["metadata", "agent"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const rows = await getPlanPointsView();
  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const values: Array<{ product: PlanProduct; plan: string; value: string }> = [];
  for (const row of body.rows) {
    if (!row || typeof row !== "object") {
      return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
    }
    const { product, plan, value } = row as Record<string, unknown>;
    if (!PRODUCTS.includes(product as PlanProduct) || typeof plan !== "string") {
      return NextResponse.json({ ok: false, message: "Paket tidak dikenal." }, { status: 400 });
    }
    if (typeof value !== "string") {
      return NextResponse.json({ ok: false, message: "Jumlah poin tidak valid." }, { status: 400 });
    }
    const trimmed = value.trim();
    // "" clears back to the env/default fallback. Anything else must be a whole
    // number >= 0 — zero is a real allowance of nothing.
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { ok: false, message: "Jumlah poin harus bilangan bulat 0 atau lebih." },
          { status: 400 }
        );
      }
    }
    values.push({ product: product as PlanProduct, plan, value: trimmed });
  }

  await updatePlanPoints(values);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run it, then build and run the whole suite**

Run: `cd nerona-web && npx vitest run tests/lib/plan-points-route.test.ts && npm run build && npm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
cd nerona-web
git add -A src/lib src/app/api tests/lib
git commit -m "feat: read and write plan point allowances

getPlanPointsView reports the stored value and the effective figure
separately, so the panel can show a placeholder while telling the owner what
is actually in force. Blank clears back to the env/default fallback; zero is
a real allowance of nothing and is stored as such."
```

---

### Task 4: `AdminPlanPointsPanel` in Pengaturan

**Files:**
- Create: `src/components/admin/AdminPlanPointsPanel.tsx`
- Modify: `src/app/(admin)/admin/pengaturan/page.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/admin/plan-points` (Task 3).
- Produces: `AdminPlanPointsPanel` — a client component taking no props.

No tests: the codebase has no component tests, and `vitest.config.ts` runs a node environment.

It cannot fold into `AdminPricingPanel` — that panel renders one row per `Plan` table row, and agent plans have no rows there.

- [ ] **Step 1: Create `src/components/admin/AdminPlanPointsPanel.tsx`**

The card, heading, input, and button classes are copied from `AdminAiSettingsPanel.tsx` so the panel sits alongside the others without restyling.

```tsx
"use client";

import { useEffect, useState } from "react";

interface PlanPointsRow {
  product: "metadata" | "agent";
  plan: string;
  label: string;
  stored: string;
  effective: number;
}

const PRODUCT_TITLES: Record<string, string> = {
  metadata: "🖼️ Metadata",
  agent: "💬 Agent",
};

const inputClass =
  "w-full rounded-xl bg-surface px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 transition focus:outline-none focus:ring-2 focus:ring-brand-blue/40";

export function AdminPlanPointsPanel() {
  const [rows, setRows] = useState<PlanPointsRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function keyOf(row: { product: string; plan: string }) {
    return `${row.product}:${row.plan}`;
  }

  async function load() {
    const res = await fetch("/api/admin/plan-points");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat poin paket.");
      return;
    }
    setRows(data.rows);
    const next: Record<string, string> = {};
    for (const row of data.rows as PlanPointsRow[]) next[keyOf(row)] = row.stored;
    setDrafts(next);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    const res = await fetch("/api/admin/plan-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          product: row.product,
          plan: row.plan,
          value: drafts[keyOf(row)] ?? "",
        })),
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.message || "Gagal menyimpan poin paket.");
      return;
    }
    setSaved(true);
    load();
  }

  const products: Array<"metadata" | "agent"> = ["metadata", "agent"];

  return (
    <section className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-lg font-semibold text-ink">Poin per paket</h2>
      <p className="mt-1 text-xs text-muted">
        Poin yang diberikan saat paket diaktifkan atau diperpanjang. Kosongkan untuk pakai
        default.
      </p>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

      <div className="mt-4 space-y-5">
        {products.map((product) => {
          const productRows = rows.filter((row) => row.product === product);
          if (productRows.length === 0) return null;
          return (
            <div key={product}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {PRODUCT_TITLES[product]}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {productRows.map((row) => {
                  const id = `points-${row.product}-${row.plan}`;
                  return (
                    <div key={keyOf(row)}>
                      <label htmlFor={id} className="text-xs font-medium text-ink">
                        {row.label}
                      </label>
                      <input
                        id={id}
                        type="text"
                        inputMode="numeric"
                        value={drafts[keyOf(row)] ?? ""}
                        onChange={(e) => {
                          setSaved(false);
                          setDrafts((prev) => ({ ...prev, [keyOf(row)]: e.target.value }));
                        }}
                        placeholder={String(row.effective)}
                        className={`mt-1 ${inputClass}`}
                      />
                      <p className="mt-1 text-[11px] text-muted/80">
                        Berlaku: {row.effective.toLocaleString("id-ID")} poin
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan poin paket"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">✓ Tersimpan</span>}
      </div>
    </section>
  );
}
```

Note `onChange` calls `setSaved(false)`. The AI settings panel does not do this, and the result is a "✓ Tersimpan" badge that stays lit after the field is edited — the UI then claims the current value is saved when it is not. Do not copy that behaviour here.

- [ ] **Step 2: Add the panel to the settings page**

`src/app/(admin)/admin/pengaturan/page.tsx` becomes:

```tsx
import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";
import { AdminBankSettingsPanel } from "@/components/admin/AdminBankSettingsPanel";
import { AdminAiSettingsPanel } from "@/components/admin/AdminAiSettingsPanel";
import { AdminPlanPointsPanel } from "@/components/admin/AdminPlanPointsPanel";

export default function AdminSettingsPage() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <AdminBankSettingsPanel />
      <AdminPricingPanel />
      <AdminPlanPointsPanel />
      <AdminAiSettingsPanel />
    </div>
  );
}
```

- [ ] **Step 3: Build and run the suite**

Run: `cd nerona-web && npm run build && npm test`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
cd nerona-web
git add src/components/admin/AdminPlanPointsPanel.tsx "src/app/(admin)/admin/pengaturan/page.tsx"
git commit -m "feat: add the plan points panel to Pengaturan

Six inputs grouped by product, each showing the effective figure as its
placeholder so the owner can see what is in force while the field is blank.
Cannot fold into AdminPricingPanel: that renders one row per Plan table row,
and agent plans have none.

Editing a field clears the saved badge — AdminAiSettingsPanel does not, which
is why its badge can claim an edited value is stored."
```

---

### Task 5: Points column in the admin users list

**Files:**
- Modify: `src/app/api/admin/users/route.ts` — return each user's balance
- Modify: `src/components/admin/AdminUsersDirectory.tsx` — add the column
- Create: `tests/lib/admin-users-balance.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: each row in `GET /api/admin/users` gains `points: number`. `UserRow` in the directory gains `points: number`.

The balance must come from **one** grouped query, not `getBalance` per user — a 25-row page would otherwise fire 25 aggregates.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/admin-users-balance.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    pointTransaction: { groupBy: vi.fn(async () => []) },
  },
}));

import { GET } from "@/app/api/admin/users/route";
import { prisma } from "@/lib/prisma";

function request(): Request {
  return new Request("http://localhost/api/admin/users");
}

const USERS = [
  {
    id: "user-1",
    email: "a@example.com",
    name: "A",
    createdAt: new Date("2026-01-01"),
    adminRole: null,
    licenses: [],
    agentProfile: null,
  },
  {
    id: "user-2",
    email: "b@example.com",
    name: "B",
    createdAt: new Date("2026-01-02"),
    adminRole: null,
    licenses: [],
    agentProfile: null,
  },
];

describe("GET /api/admin/users balances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    (prisma.user.count as any).mockResolvedValue(2);
    (prisma.user.findMany as any).mockResolvedValue(USERS);
  });

  it("attaches each user's point balance", async () => {
    (prisma.pointTransaction.groupBy as any).mockResolvedValue([
      { userId: "user-1", _sum: { delta: 5_000 } },
    ]);

    const res = await GET(request());
    const body = await res.json();

    expect(body.users[0].points).toBe(5_000);
    // No ledger rows at all means zero, not undefined.
    expect(body.users[1].points).toBe(0);
  });

  it("treats a null sum as zero", async () => {
    (prisma.pointTransaction.groupBy as any).mockResolvedValue([
      { userId: "user-1", _sum: { delta: null } },
    ]);

    const res = await GET(request());
    const body = await res.json();

    expect(body.users[0].points).toBe(0);
  });

  it("reads every balance in one grouped query, not one per user", async () => {
    await GET(request());

    expect(prisma.pointTransaction.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.pointTransaction.groupBy).toHaveBeenCalledWith({
      by: ["userId"],
      where: { userId: { in: ["user-1", "user-2"] } },
      _sum: { delta: true },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/admin-users-balance.test.ts`
Expected: FAIL — `body.users[0].points` is `undefined`.

- [ ] **Step 3: Return the balance from the route**

In `src/app/api/admin/users/route.ts`, after the existing `Promise.all` block and before `const rows = users.map(...)`:

```ts
  // One grouped query rather than getBalance per user — a 25-row page would
  // otherwise fire 25 aggregates.
  const balances = await prisma.pointTransaction.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((user) => user.id) } },
    _sum: { delta: true },
  });
  const pointsByUser = new Map(balances.map((b) => [b.userId, b._sum.delta ?? 0]));
```

Then add to the object returned by `users.map`:

```ts
      points: pointsByUser.get(user.id) ?? 0,
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd nerona-web && npx vitest run tests/lib/admin-users-balance.test.ts`
Expected: PASS, all three cases.

- [ ] **Step 5: Add the column to the table**

In `src/components/admin/AdminUsersDirectory.tsx`:

Add to the `UserRow` interface:

```ts
  points: number;
```

Raise the table's minimum width — a seventh column at `min-w-[720px]` compresses the others instead of scrolling:

```tsx
          <table className="w-full min-w-[820px] text-left text-sm">
```

Add the header cell after `Agent` and before `Terdaftar`:

```tsx
                <th className="px-4 py-3 font-medium">Poin</th>
```

Add the body cell in the same position (after the Agent cell, before the Terdaftar cell):

```tsx
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-ink">
                      {row.points.toLocaleString("id-ID")}
                    </td>
```

Update the empty-state `colSpan` from 5 to 6:

```tsx
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
```

- [ ] **Step 6: Build and run the suite**

Run: `cd nerona-web && npm run build && npm test`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
cd nerona-web
git add src/app/api/admin/users/route.ts src/components/admin/AdminUsersDirectory.tsx tests/lib/admin-users-balance.test.ts
git commit -m "feat: show each user's point balance in the admin users list

Display only — editing stays in UserFinancePanel, which requires a note.

The balance comes from one grouped query rather than getBalance per user; a
25-row page would otherwise fire 25 aggregates. Table minimum width goes
720px -> 820px so the seventh column scrolls instead of compressing."
```

---

### Task 6: Backfill script for existing empty wallets

**Files:**
- Create: `scripts/backfill-metadata-plan-points.ts`
- Modify: `package.json` — add a script entry
- Modify: `prisma/schema.prisma:PointTransaction` — the `reason` comment is stale

**Interfaces:**
- Consumes: `creditPlanPoints`, `normalizePlan` from `@/lib/plan-points` (Task 1).
- Produces: `npm run backfill:metadata-points`.

No unit test: this is a one-off operational script whose logic is a single query plus a loop over `creditPlanPoints`, which Task 1 already covers. Idempotency is verified by running it twice (see Verification).

- [ ] **Step 1: Create `scripts/backfill-metadata-plan-points.ts`**

```ts
/**
 * One-off: grant metadata point allowances to tenants who activated before
 * allowances existed for metadata at all.
 *
 * Before this, fulfillOrderRequest credited points only for agent orders, so a
 * metadata tenant ended up with an active license and an empty wallet while
 * api/extension/generate spends points on every call.
 *
 * Idempotent by construction: a metadata plan_grant row is the marker, so a
 * second run credits nobody. Safe to re-run.
 *
 *   npm run backfill:metadata-points          # report only
 *   npm run backfill:metadata-points -- --write
 */
import { prisma } from "../src/lib/prisma";
import { creditPlanPoints, normalizePlan } from "../src/lib/plan-points";

const WRITE = process.argv.includes("--write");

async function main() {
  const licenses = await prisma.license.findMany({
    where: { status: { in: ["active", "comp"] } },
    select: {
      userId: true,
      plan: { select: { name: true } },
      user: { select: { email: true } },
    },
  });

  // One license per user is the shape the app assumes elsewhere; if a user has
  // several, the most recent active one wins.
  const byUser = new Map<string, { plan: string; email: string }>();
  for (const license of licenses) {
    if (!license.plan?.name) continue;
    byUser.set(license.userId, {
      plan: license.plan.name,
      email: license.user?.email ?? license.userId,
    });
  }

  const alreadyGranted = await prisma.pointTransaction.findMany({
    where: {
      userId: { in: [...byUser.keys()] },
      reason: "plan_grant",
      note: { startsWith: "Bonus paket Metadata" },
    },
    select: { userId: true },
  });
  const skip = new Set(alreadyGranted.map((row) => row.userId));

  let credited = 0;
  let skipped = 0;

  for (const [userId, { plan, email }] of byUser) {
    if (skip.has(userId)) {
      skipped += 1;
      continue;
    }
    if (!WRITE) {
      console.log(`would credit ${email} — metadata ${normalizePlan(plan)}`);
      credited += 1;
      continue;
    }
    const amount = await creditPlanPoints({ userId, product: "metadata", plan });
    console.log(`credited ${email} — metadata ${normalizePlan(plan)} — ${amount} poin`);
    if (amount > 0) credited += 1;
  }

  console.log(
    `\n${WRITE ? "Credited" : "Would credit"}: ${credited}. Already had a grant: ${skipped}.`
  );
  if (!WRITE) console.log("Dry run — re-run with --write to apply.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

The `note: { startsWith: "Bonus paket Metadata" }` filter is why Task 1 put the product in the note. Without it there is no way to tell a metadata grant from an agent one, and the script cannot be idempotent.

- [ ] **Step 2: Add the script entry to `package.json`**

Alongside the existing `prisma:*` scripts, which already use `dotenv -e .env.local`:

```json
    "backfill:metadata-points": "dotenv -e .env.local -- tsx scripts/backfill-metadata-plan-points.ts",
```

`tsx` is already a devDependency and is what `prisma.seed` (`"tsx prisma/seed.ts"`) uses, so no new dependency is needed.

- [ ] **Step 3: Fix the stale comment in the schema**

`prisma/schema.prisma` documents `reason` as `"manual_adjust" | "spend" (future: "topup")`, but `plan_grant` has been written for a while and this plan adds more of them:

```prisma
  reason      String   // "manual_adjust" | "spend" | "plan_grant" | "topup"
```

This is a comment only — no migration.

- [ ] **Step 4: Dry-run the script**

Run: `cd nerona-web && npm run backfill:metadata-points`
Expected: lists the tenants that would be credited and exits without writing. If it lists nobody and reports `Already had a grant: 0`, there are no affected tenants and nothing to apply.

- [ ] **Step 5: Build and run the suite**

Run: `cd nerona-web && npm run build && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
cd nerona-web
git add scripts/backfill-metadata-plan-points.ts package.json prisma/schema.prisma
git commit -m "feat: add a backfill for metadata tenants with empty wallets

Tenants who activated a metadata plan before allowances existed hold an
active license and no points. This credits them, idempotently: a metadata
plan_grant row is the marker, so a second run credits nobody.

Dry run by default; --write applies. Also corrects the stale reason comment
on PointTransaction, which never listed plan_grant."
```

---

## Final Verification

Automated first, then manual against `npm run dev`.

- [ ] `cd nerona-web && npm run build` — succeeds.
- [ ] `cd nerona-web && npm test` — all suites pass.
- [ ] **Metadata order activation:** owner activates a pending metadata Pro order → the tenant's balance rises by 5,000 and Finance shows one `Bonus paket Metadata Pro` row. **Exactly one** — two rows means the metadata branch is crediting on top of `grantLicense`.
- [ ] **Agent order activation:** activate a pending agent Pro order → balance rises by 11,000, one `Bonus paket Agent Pro` row.
- [ ] **Renewal:** activate a renewal order → the note reads `Perpanjangan paket …`, not `Bonus paket …`.
- [ ] **Manual metadata grant:** grant a license from the user detail page → allowance credited.
- [ ] **Manual agent activation:** activate an agent plan through the admin agent control → allowance credited.
- [ ] **Configured value wins:** Pengaturan → set Metadata Pro to `777` → save → activate a metadata Pro order → 777 credited.
- [ ] **Zero:** set Metadata Pro to `0` → activate → nothing credited and no ledger row written.
- [ ] **Blank clears:** clear Metadata Pro → the field's placeholder returns to `5000` and that is what gets credited.
- [ ] **Rejection:** enter `-1` or `1.5` → save fails with "Jumlah poin harus bilangan bulat 0 atau lebih." and nothing is stored.
- [ ] **Saved badge:** edit a field after saving → the "✓ Tersimpan" badge disappears rather than claiming the new value is stored.
- [ ] **Users list:** the Poin column matches each user's detail-page balance; the table scrolls sideways inside its wrapper at ~1024px rather than compressing.
- [ ] **Backfill idempotency:** run `npm run backfill:metadata-points -- --write`, then run it again — the second run reports crediting nobody.

## Risks

**Double-crediting metadata.** `fulfillOrderRequest`'s metadata branch calls `grantLicense`, which now credits. A credit call in the branch as well silently doubles every metadata activation. Task 2 Step 5 pins this with a test, and the first manual verification step checks for exactly one ledger row.

**Plan-name casing.** Metadata plans are capitalised in the `Plan` table, agent plans lowercase. Every lookup must pass through `normalizePlan`; a raw `"Pro"` resolves to no allowance and grants nothing without erroring — the original bug, wearing a different hat.

**Backfill depends on the note format.** Idempotency is keyed on `note` starting with `"Bonus paket Metadata"`. If the note wording in `creditPlanPoints` changes, update the script's filter in the same commit or the backfill will credit already-credited tenants on its next run.
