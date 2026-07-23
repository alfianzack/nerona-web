# Monthly Package Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paid packages activate through the end of the current calendar month (Asia/Jakarta); the WhatsApp agent stops for expired paid plans; metadata license `validUntil` is set + shown (enforcement later).

**Architecture:** A pure `billing-period` helper computes the month-end boundary; activation code stamps `AgentProfile.planExpiresAt` / `License.validUntil`; the agent webhook lazily gates on expiry (no cron). Metadata expiry is tracked/displayed only.

**Tech Stack:** Next.js 14 + TypeScript + Prisma 5 + Vitest.

## Global Constraints

- Expiry instant = first moment of NEXT calendar month in Asia/Jakarta = fixed UTC+7 (no DST). Valid while `now < expiresAt`; `now >= expiresAt` is expired.
- Paid agent plans = `pro`, `business`. `free` never expires. A paid plan with `planExpiresAt = null` (legacy) is NOT expired (grandfathered) — do not cut off existing tenants on deploy.
- Enforcement is AGENT ONLY (webhook gate, lazy, no DB downgrade, no cron). Metadata: only set/show `License.validUntil`; the extension is NOT gated by this app.
- Points wallet is independent and untouched.
- Prisma CLI via `npm run prisma:migrate`. Import alias `@/` → `src/`. Tests mock `@/lib/prisma`.
- Commit on master with EXPLICIT file paths; NEVER `git add -A`. `core.autocrlf=true` prints harmless CRLF warnings.

---

### Task 1: `src/lib/billing-period.ts`

**Files:**
- Create: `src/lib/billing-period.ts`
- Test: `tests/lib/billing-period.test.ts`

**Interfaces:**
- Produces: `monthlyExpiryFrom(now: Date): Date`; `isExpired(expiresAt: Date | null, now?: Date): boolean`.

- [ ] **Step 1: Write the failing test** — `tests/lib/billing-period.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { monthlyExpiryFrom, isExpired } from "@/lib/billing-period";

describe("monthlyExpiryFrom", () => {
  it("returns next month 1st 00:00 WIB (UTC+7) for a mid-month date", () => {
    // 2026-07-15 12:00 WIB === 2026-07-15T05:00:00Z
    // Aug 1 00:00 WIB === 2026-07-31T17:00:00Z
    expect(monthlyExpiryFrom(new Date("2026-07-15T05:00:00Z")).toISOString()).toBe(
      "2026-07-31T17:00:00.000Z"
    );
  });

  it("rolls December into next January", () => {
    // 2026-12-20 07:00 WIB === 2026-12-20T00:00:00Z → Jan 1 2027 00:00 WIB === 2026-12-31T17:00:00Z
    expect(monthlyExpiryFrom(new Date("2026-12-20T00:00:00Z")).toISOString()).toBe(
      "2026-12-31T17:00:00.000Z"
    );
  });

  it("at the month boundary instant, targets the following month end", () => {
    // 2026-07-31T17:00:00Z === Aug 1 00:00 WIB → next boundary Sep 1 00:00 WIB === 2026-08-31T17:00:00Z
    expect(monthlyExpiryFrom(new Date("2026-07-31T17:00:00Z")).toISOString()).toBe(
      "2026-08-31T17:00:00.000Z"
    );
  });
});

describe("isExpired", () => {
  const now = new Date("2026-07-15T00:00:00Z");
  it("is false for null", () => expect(isExpired(null, now)).toBe(false));
  it("is false for a future date", () => expect(isExpired(new Date("2026-08-01T00:00:00Z"), now)).toBe(false));
  it("is true for a past date", () => expect(isExpired(new Date("2026-07-01T00:00:00Z"), now)).toBe(true));
  it("is true at the exact instant", () => expect(isExpired(now, now)).toBe(true));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/billing-period.test.ts`
Expected: FAIL — cannot find module `@/lib/billing-period`.

- [ ] **Step 3: Create `src/lib/billing-period.ts`**

```ts
// Asia/Jakarta is a fixed UTC+7 offset (no DST).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// The UTC instant of the first moment of NEXT month in WIB. A monthly package
// activated at `now` is valid while `now < monthlyExpiryFrom(now)`.
export function monthlyExpiryFrom(now: Date): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const boundaryUtcMs = Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - WIB_OFFSET_MS;
  return new Date(boundaryUtcMs);
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt != null && now.getTime() >= expiresAt.getTime();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/billing-period.test.ts`
Expected: PASS (7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing-period.ts tests/lib/billing-period.test.ts
git commit -m "feat: monthly billing-period helper (WIB month-end + isExpired)"
```

---

### Task 2: `planExpiresAt` column + `isAgentPlanExpired`

**Files:**
- Modify: `prisma/schema.prisma` (add `AgentProfile.planExpiresAt`)
- Modify: `src/lib/agent/admin.ts` (add `PAID_AGENT_PLANS`, `isAgentPlanExpired`)
- Test: `tests/lib/agent/plan-expiry.test.ts`

**Interfaces:**
- Consumes: `isExpired` from `@/lib/billing-period`.
- Produces: `PAID_AGENT_PLANS: readonly ["pro","business"]`; `isAgentPlanExpired(profile: { plan: string; planExpiresAt: Date | null }, now?: Date): boolean`.

- [ ] **Step 1: Add the column to `prisma/schema.prisma`**

In `model AgentProfile`, after the `plan String @default("free") ...` line, add:

```prisma
  planExpiresAt       DateTime? // paid plan valid until this instant; null = free/no expiry
```

- [ ] **Step 2: Create and apply the migration**

Run: `npm run prisma:migrate -- --name add_agent_plan_expires_at`
Expected: new migration folder; "in sync"; client regenerated so `planExpiresAt` is typed.

- [ ] **Step 3: Write the failing test** — `tests/lib/agent/plan-expiry.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isAgentPlanExpired } from "@/lib/agent/admin";

const now = new Date("2026-07-15T00:00:00Z");
const past = new Date("2026-07-01T00:00:00Z");
const future = new Date("2026-08-01T00:00:00Z");

describe("isAgentPlanExpired", () => {
  it("true for a paid plan past its expiry", () => {
    expect(isAgentPlanExpired({ plan: "pro", planExpiresAt: past }, now)).toBe(true);
  });
  it("false for a paid plan not yet expired", () => {
    expect(isAgentPlanExpired({ plan: "business", planExpiresAt: future }, now)).toBe(false);
  });
  it("false for a paid plan with null expiry (legacy grandfathered)", () => {
    expect(isAgentPlanExpired({ plan: "pro", planExpiresAt: null }, now)).toBe(false);
  });
  it("false for the free plan even with a past date", () => {
    expect(isAgentPlanExpired({ plan: "free", planExpiresAt: past }, now)).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- tests/lib/agent/plan-expiry.test.ts`
Expected: FAIL — `isAgentPlanExpired` not exported.

- [ ] **Step 5: Add to `src/lib/agent/admin.ts`**

Add the import at the top:

```ts
import { isExpired } from "@/lib/billing-period";
```

Add near the existing `AGENT_PLANS` export:

```ts
export const PAID_AGENT_PLANS = ["pro", "business"] as const;

export function isAgentPlanExpired(
  profile: { plan: string; planExpiresAt: Date | null },
  now: Date = new Date()
): boolean {
  return (PAID_AGENT_PLANS as readonly string[]).includes(profile.plan) && isExpired(profile.planExpiresAt, now);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent/plan-expiry.test.ts`
Expected: PASS (4).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/agent/admin.ts tests/lib/agent/plan-expiry.test.ts
git commit -m "feat: AgentProfile.planExpiresAt + isAgentPlanExpired helper"
```

---

### Task 3: Stamp expiry on activation (agent + license)

**Files:**
- Modify: `src/lib/orders.ts` (agent fulfill branch + free-activation path)
- Modify: `src/lib/agent/admin.ts` (`activateAgentProfile`)
- Modify: `src/lib/admin-grants.ts` (`grantLicense`)
- Test: update `tests/lib/orders.test.ts` and `tests/lib/admin-grants.test.ts`

**Interfaces:**
- Consumes: `monthlyExpiryFrom` from `@/lib/billing-period`.

- [ ] **Step 1: Set `planExpiresAt` in `src/lib/orders.ts`**

Add the import:

```ts
import { monthlyExpiryFrom } from "@/lib/billing-period";
```

In `fulfillOrderRequest`, the agent branch `agentProfile.upsert` — add `planExpiresAt` to BOTH update and create (the agent branch only grants paid plans):

```ts
    const expiresAt = monthlyExpiryFrom(new Date());
    await prisma.agentProfile.upsert({
      where: { userId: order.user.id },
      update: { status: "active", plan, planExpiresAt: expiresAt },
      create: { userId: order.user.id, status: "active", plan, planExpiresAt: expiresAt },
    });
```

In the free-activation path (the `agentProfile.update`/`create` that sets `plan: "free"` / `status: "active"`), add `planExpiresAt: null` to the data so activating free clears any prior expiry.

- [ ] **Step 2: Set `planExpiresAt` in `src/lib/agent/admin.ts` `activateAgentProfile`**

Add the import `import { monthlyExpiryFrom } from "@/lib/billing-period";`. Replace the upsert body so expiry tracks the plan:

```ts
  const paid = plan ? (PAID_AGENT_PLANS as readonly string[]).includes(plan) : false;
  const expiryData =
    plan === undefined ? {} : { planExpiresAt: paid ? monthlyExpiryFrom(new Date()) : null };

  await prisma.agentProfile.upsert({
    where: { userId: user.id },
    update: { status: "active", ...(plan ? { plan } : {}), ...expiryData },
    create: { userId: user.id, status: "active", ...(plan ? { plan } : {}), ...expiryData },
  });
```

(When `plan` is undefined — activating without changing the plan — `planExpiresAt` is left untouched.)

- [ ] **Step 3: Set `validUntil` in `src/lib/admin-grants.ts` `grantLicense`**

Add the import `import { monthlyExpiryFrom } from "@/lib/billing-period";`. In `grantLicense`, add `validUntil: monthlyExpiryFrom(new Date())` to BOTH the `license.update` data and the `license.create` data (alongside the existing `status:"active"`, `planId`, etc.).

- [ ] **Step 4: Update existing tests**

In `tests/lib/orders.test.ts`, the agent-fulfill test(s): after fulfilling, assert the `agentProfile.upsert`/update was called with a `planExpiresAt` that is a `Date` (e.g. `expect.any(Date)` in the `update`/`create` data). Add `planExpiresAt` to any profile fixture as needed.

In `tests/lib/admin-grants.test.ts`, the grant tests: assert `license.create`/`license.update` was called with `validUntil: expect.any(Date)`.

Keep all other assertions intact.

- [ ] **Step 5: Run the affected tests**

Run: `npm test -- tests/lib/orders.test.ts tests/lib/admin-grants.test.ts`
Expected: PASS. (Note: `orders.test.ts` had 2 PRE-EXISTING unrelated failures before this feature — if they persist and are unrelated to expiry, leave them; do not fix. Confirm you introduce no NEW failures beyond those two.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/orders.ts src/lib/agent/admin.ts src/lib/admin-grants.ts tests/lib/orders.test.ts tests/lib/admin-grants.test.ts
git commit -m "feat: stamp month-end expiry on agent/license activation"
```

---

### Task 4: Enforce agent expiry in the webhook

**Files:**
- Modify: `src/lib/agent/webhook-handler.ts`
- Test: update `tests/lib/agent/webhook-handler.test.ts`

**Interfaces:**
- Consumes: `isAgentPlanExpired` from `@/lib/agent/admin`.

- [ ] **Step 1: Ensure the profile carries `planExpiresAt`**

Check `findProfileByPhone` (in `src/lib/agent/...`, used by `webhook-handler.ts`). If it uses an explicit Prisma `select`, add `planExpiresAt: true` and `plan: true` so the gate can read them. If it returns the full record (no `select`), no change needed — note which in your report.

- [ ] **Step 2: Write the failing test** — add to `tests/lib/agent/webhook-handler.test.ts`

Add `isAgentPlanExpired` to the picture: the handler imports it from `@/lib/agent/admin`. Add a test where the profile is an active, phone-verified `pro` plan with `planExpiresAt` in the past, and assert the handler sends a renewal ("perpanjang"/"berakhir") static reply and does NOT enqueue a job (`createJob` not called). Mirror the existing quota-exceeded test's structure and mocks; set `planExpiresAt` in the profile fixture (null for the existing passing tests so they aren't treated as expired).

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/lib/agent/webhook-handler.test.ts`
Expected: FAIL — expiry not enforced; the job is still enqueued.

- [ ] **Step 4: Add the gate to `src/lib/agent/webhook-handler.ts`**

Add the import:

```ts
import { isAgentPlanExpired } from "./admin";
```

Insert this block AFTER the phone-verified block and BEFORE the `hasExceededMonthlyLimit` check:

```ts
  if (isAgentPlanExpired(profile)) {
    await replyStatic(
      phone,
      profile.id,
      `Paket Anda sudah berakhir. Silakan perpanjang di ${baseUrl()}/agent untuk melanjutkan.`
    );
    return { status: 200 };
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent/webhook-handler.test.ts`
Expected: PASS (new expiry test + existing tests, with fixtures given `planExpiresAt: null`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/webhook-handler.ts tests/lib/agent/webhook-handler.test.ts
git commit -m "feat: agent refuses expired paid plans (month-end enforcement)"
```

---

### Task 5: Show package validity on the tenant Finance page

**Files:**
- Modify: `src/app/finance/page.tsx`

**Interfaces:**
- Consumes: `prisma`, `isAgentPlanExpired` from `@/lib/agent/admin`.

- [ ] **Step 1: Load agent profile + license in `src/app/finance/page.tsx`**

Add to the `Promise.all` (alongside the existing balance/transactions/orderRequests/orders):

```ts
    prisma.agentProfile.findUnique({
      where: { userId: session.user.id },
      select: { plan: true, status: true, planExpiresAt: true },
    }),
    prisma.license.findFirst({
      where: { userId: session.user.id, status: { in: ["active", "comp"] } },
      orderBy: { createdAt: "desc" },
      select: { validUntil: true, status: true, plan: { select: { name: true } } },
    }),
```

Name them `agentProfile` and `license` in the destructure.

- [ ] **Step 2: Render a "Paket" section above the Poin card**

Add this import at the top: `import { isAgentPlanExpired } from "@/lib/agent/admin";`

Add a helper near `fmtDate`:

```tsx
function fmtDateOrNull(d: Date | null): string {
  return d ? fmtDate(d) : "—";
}
```

Insert a Paket card as the first section (before the Poin `<section>`):

```tsx
        <section className={`mt-8 ${cardClass}`}>
          <h2 className="text-sm font-semibold text-ink">Paket</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink">
                Agent WhatsApp
                {agentProfile ? <span className="text-muted"> · {agentProfile.plan}</span> : null}
              </span>
              <span className="text-xs text-muted">
                {!agentProfile || agentProfile.plan === "free"
                  ? "Paket free"
                  : isAgentPlanExpired(agentProfile)
                    ? "Berakhir — silakan perpanjang"
                    : `Berlaku sampai ${fmtDateOrNull(agentProfile.planExpiresAt)}`}
              </span>
            </li>
            {license && (
              <li className="flex items-center justify-between gap-3">
                <span className="text-ink">
                  Metadata
                  {license.plan?.name ? <span className="text-muted"> · {license.plan.name}</span> : null}
                </span>
                <span className="text-xs text-muted">
                  {license.validUntil ? `Berlaku sampai ${fmtDate(license.validUntil)}` : "Aktif"}
                </span>
              </li>
            )}
          </ul>
        </section>
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: succeeds, no type errors; `/finance` shows a "Paket" section with agent + metadata validity.

- [ ] **Step 4: Commit**

```bash
git add src/app/finance/page.tsx
git commit -m "feat: show package validity (agent + metadata) on tenant Finance page"
```

---

## Self-Review Notes

- **Spec coverage:** month-end boundary + isExpired (Task 1); column + agent-expiry predicate with free/legacy handling (Task 2); expiry stamped on every activation path incl. metadata `validUntil` (Task 3); agent enforcement gate with renewal reply, no job enqueued (Task 4); tracking/visibility on the tenant Finance page (Task 5).
- **Deferred (per spec):** metadata enforcement, downgrade cron, per-tenant timezone, pro-rating/grace/roll-over, auto-downgrade-to-free.
- **Type consistency:** `monthlyExpiryFrom`/`isExpired` (Task 1) consumed in Tasks 2–3; `isAgentPlanExpired` (Task 2) consumed in Tasks 4–5; `AgentProfile.planExpiresAt` added in Task 2 before any code reads/writes it.
- **Safety:** legacy paid plans (`planExpiresAt = null`) are grandfathered (not expired), so deploying does not cut off current tenants; enforcement is lazy (no cron), so nothing is destructively downgraded.
