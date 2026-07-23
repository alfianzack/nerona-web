# Auto-Renew (Semi-Automatic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monthly packages renew semi-automatically: a daily cron auto-creates a renewal request 3 days before expiry, the tenant uploads their transfer receipt, and the owner's one-click confirm extends the plan by +1 month (forward-stacking).

**Architecture:** Reuse `OrderRequest` (tagged `isRenewal`) + the existing proof-upload + `/admin/orders` fulfill flow. A cron generates due renewals; `fulfillOrderRequest` becomes renewal-aware; a `billing-period` helper does +1-month forward-stacking. First activation keeps end-of-month; renewals stack +1 month.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Prisma 5 + Vitest. Cron via Vercel cron + `CRON_SECRET`.

## Global Constraints

- First activation → `monthlyExpiryFrom(now)` (end of current calendar month, WIB). Renewal (`isRenewal`) → +1 calendar month from `max(now, current expiry)` (forward-stacking).
- Paid agent plans = `pro`, `business`. WIB = fixed UTC+7.
- Cron auth mirrors `src/app/api/agent/cron/route.ts`: `CRON_SECRET` env + `Authorization: Bearer <secret>` → else 401.
- Renewal generation is idempotent: never create a second pending request when one already exists for the same user+product. Lead time = 3 days.
- Agent renewal is enforced (via the existing expiry gate); metadata renewal only extends `License.validUntil` (not enforced here).
- All user-facing copy Indonesian. Import alias `@/` → `src/`. Tests mock `@/lib/prisma`.
- Commit on master with EXPLICIT file paths; NEVER `git add -A`. `core.autocrlf=true` prints harmless CRLF warnings.

---

### Task 1: `OrderRequest.isRenewal` + forward-stacking helpers

**Files:**
- Modify: `prisma/schema.prisma` (`OrderRequest.isRenewal`)
- Modify: `src/lib/billing-period.ts` (add `addOneMonthJakarta`, `renewedExpiryFrom`)
- Test: `tests/lib/billing-period.test.ts` (extend)

**Interfaces:**
- Produces: `addOneMonthJakarta(base: Date): Date`; `renewedExpiryFrom(currentExpiry: Date | null, now: Date): Date`. (Existing `monthlyExpiryFrom`, `isExpired` unchanged.)

- [ ] **Step 1: Add the column to `prisma/schema.prisma`**

In `model OrderRequest`, after the `status String @default("pending") ...` line, add:

```prisma
  isRenewal     Boolean   @default(false) // auto-generated monthly renewal request
```

- [ ] **Step 2: Migrate**

Run: `npm run prisma:migrate -- --name add_order_request_is_renewal`
Expected: new migration folder; "in sync"; client regenerated with `isRenewal`.

- [ ] **Step 3: Add the failing tests** — append to `tests/lib/billing-period.test.ts`

```ts
import { addOneMonthJakarta, renewedExpiryFrom } from "@/lib/billing-period";

describe("addOneMonthJakarta", () => {
  it("advances a month-boundary instant to the next month boundary", () => {
    // 2026-07-31T17:00:00Z === Aug 1 00:00 WIB → +1mo → Sep 1 00:00 WIB === 2026-08-31T17:00:00Z
    expect(addOneMonthJakarta(new Date("2026-07-31T17:00:00Z")).toISOString()).toBe(
      "2026-08-31T17:00:00.000Z"
    );
  });
  it("advances a mid-month instant by one calendar month (same day/time WIB)", () => {
    // 2026-07-10T05:00:00Z === Jul 10 12:00 WIB → Aug 10 12:00 WIB === 2026-08-10T05:00:00Z
    expect(addOneMonthJakarta(new Date("2026-07-10T05:00:00Z")).toISOString()).toBe(
      "2026-08-10T05:00:00.000Z"
    );
  });
  it("rolls December into next January", () => {
    // 2026-12-15T00:00:00Z === Dec 15 07:00 WIB → Jan 15 2027 07:00 WIB === 2027-01-15T00:00:00Z
    expect(addOneMonthJakarta(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe(
      "2027-01-15T00:00:00.000Z"
    );
  });
});

describe("renewedExpiryFrom", () => {
  it("forward-stacks from a still-future expiry", () => {
    // current Aug 1 00:00 WIB (2026-07-31T17:00Z), now before it → base=current → Sep 1 00:00 WIB
    expect(
      renewedExpiryFrom(new Date("2026-07-31T17:00:00Z"), new Date("2026-07-20T00:00:00Z")).toISOString()
    ).toBe("2026-08-31T17:00:00.000Z");
  });
  it("extends from now when expiry is null", () => {
    expect(renewedExpiryFrom(null, new Date("2026-07-10T05:00:00Z")).toISOString()).toBe(
      "2026-08-10T05:00:00.000Z"
    );
  });
  it("extends from now when already lapsed", () => {
    expect(
      renewedExpiryFrom(new Date("2026-06-30T17:00:00Z"), new Date("2026-07-10T05:00:00Z")).toISOString()
    ).toBe("2026-08-10T05:00:00.000Z");
  });
});
```

- [ ] **Step 4: Run to verify RED**

Run: `npm test -- tests/lib/billing-period.test.ts`
Expected: FAIL — `addOneMonthJakarta`/`renewedExpiryFrom` not exported.

- [ ] **Step 5: Add to `src/lib/billing-period.ts`** (below the existing exports; reuse the file's existing `WIB_OFFSET_MS`)

```ts
// One calendar month after `base`, in WIB. JS Date.UTC normalizes month/day overflow.
export function addOneMonthJakarta(base: Date): Date {
  const wib = new Date(base.getTime() + WIB_OFFSET_MS);
  const utcMs =
    Date.UTC(
      wib.getUTCFullYear(),
      wib.getUTCMonth() + 1,
      wib.getUTCDate(),
      wib.getUTCHours(),
      wib.getUTCMinutes(),
      wib.getUTCSeconds(),
      wib.getUTCMilliseconds()
    ) - WIB_OFFSET_MS;
  return new Date(utcMs);
}

// Forward-stacking renewal: extend from the remaining time if still active, else from now.
export function renewedExpiryFrom(currentExpiry: Date | null, now: Date): Date {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return addOneMonthJakarta(base);
}
```

- [ ] **Step 6: Run to verify GREEN**

Run: `npm test -- tests/lib/billing-period.test.ts`
Expected: PASS (existing + 6 new).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/billing-period.ts tests/lib/billing-period.test.ts
git commit -m "feat: OrderRequest.isRenewal + forward-stacking expiry helpers"
```

---

### Task 2: Renewal-aware `fulfillOrderRequest` + `grantLicense` validUntil override

**Files:**
- Modify: `src/lib/orders.ts` (`fulfillOrderRequest`)
- Modify: `src/lib/admin-grants.ts` (`GrantOptions` + `grantLicense`)
- Test: update `tests/lib/orders.test.ts`, `tests/lib/admin-grants.test.ts`

**Interfaces:**
- Consumes: `renewedExpiryFrom`, `monthlyExpiryFrom` from `@/lib/billing-period`.
- Produces: `GrantOptions` gains `validUntil?: Date`.

- [ ] **Step 1: `grantLicense` accepts a `validUntil` override — `src/lib/admin-grants.ts`**

Add `validUntil?: Date;` to the `GrantOptions` interface. Ensure `monthlyExpiryFrom` is imported (added in the prior feature). In BOTH the `license.update` and `license.create` data blocks, replace the current `validUntil: monthlyExpiryFrom(new Date())` with:

```ts
        validUntil: options.validUntil ?? monthlyExpiryFrom(new Date()),
```

- [ ] **Step 2: `fulfillOrderRequest` becomes renewal-aware — `src/lib/orders.ts`**

Ensure imports include both helpers: `import { monthlyExpiryFrom, renewedExpiryFrom } from "@/lib/billing-period";`

In the agent branch, replace the current `const expiresAt = monthlyExpiryFrom(new Date());` + upsert with:

```ts
    const now = new Date();
    let expiresAt: Date;
    if (order.isRenewal) {
      const current = await prisma.agentProfile.findUnique({
        where: { userId: order.user.id },
        select: { planExpiresAt: true },
      });
      expiresAt = renewedExpiryFrom(current?.planExpiresAt ?? null, now);
    } else {
      expiresAt = monthlyExpiryFrom(now);
    }
    await prisma.agentProfile.upsert({
      where: { userId: order.user.id },
      update: { status: "active", plan, planExpiresAt: expiresAt },
      create: { userId: order.user.id, status: "active", plan, planExpiresAt: expiresAt },
    });
```

In the metadata branch, compute a renewal `validUntil` and pass it to `grantLicense`:

```ts
    let validUntil: Date | undefined;
    if (order.isRenewal) {
      const current = await prisma.license.findFirst({
        where: { userId: order.user.id, status: { in: ["active", "comp"] } },
        orderBy: { createdAt: "desc" },
        select: { validUntil: true },
      });
      validUntil = renewedExpiryFrom(current?.validUntil ?? null, new Date());
    }
    const result = await grantLicense(adminId, order.user.email, plan.id, {
      note: `Order ${order.id}`,
      validUntil,
    });
```

(`order.isRenewal` is available — `fulfillOrderRequest` loads the full `OrderRequest` record.)

- [ ] **Step 3: Update tests**

`tests/lib/admin-grants.test.ts`: add a test that `grantLicense(..., { validUntil: someDate })` passes that exact date into `license.create`/`update` (not the month-end default); keep the existing default-path assertion (`validUntil: expect.any(Date)`).

`tests/lib/orders.test.ts`: add/adjust so a fulfilled agent request with `isRenewal: true` (and a profile whose `planExpiresAt` is a known future date) results in the `agentProfile.upsert` being called with `planExpiresAt` equal to `renewedExpiryFrom(thatDate, now)` — or, more simply, `expect.any(Date)` while asserting `agentProfile.findUnique` was consulted. Ensure the fulfill-order fixtures include `isRenewal` (default `false` for the existing non-renewal tests). Mock `prisma.agentProfile.findUnique`/`prisma.license.findFirst` as needed.

- [ ] **Step 4: Run the affected tests**

Run: `npm test -- tests/lib/orders.test.ts tests/lib/admin-grants.test.ts`
Expected: `admin-grants.test.ts` fully PASS. `orders.test.ts`: the 2 PRE-EXISTING unrelated `orderId`/`submitOrder` failures may remain — do NOT fix them; confirm no NEW failures beyond those two.

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders.ts src/lib/admin-grants.ts tests/lib/orders.test.ts tests/lib/admin-grants.test.ts
git commit -m "feat: renewal fulfillment extends +1 month (forward-stacking)"
```

---

### Task 3: `generateDueRenewals`

**Files:**
- Create: `src/lib/billing/renewals.ts`
- Test: `tests/lib/renewals.test.ts`

**Interfaces:**
- Produces: `generateDueRenewals(now?: Date, leadDays?: number): Promise<{ created: number }>`.

- [ ] **Step 1: Write the failing test** — `tests/lib/renewals.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentProfile: { findMany: vi.fn() },
    license: { findMany: vi.fn() },
    orderRequest: { count: vi.fn(), create: vi.fn() },
  },
}));

import { generateDueRenewals } from "@/lib/billing/renewals";
import { prisma } from "@/lib/prisma";

const now = new Date("2026-07-29T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.agentProfile.findMany as any).mockResolvedValue([]);
  (prisma.license.findMany as any).mockResolvedValue([]);
  (prisma.orderRequest.count as any).mockResolvedValue(0);
});

describe("generateDueRenewals", () => {
  it("creates an agent renewal for a due paid profile with no pending request", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([{ userId: "u1", plan: "pro" }]);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "u1", product: "agent", planName: "Pro", isRenewal: true },
    });
    expect(res.created).toBe(1);
  });

  it("skips when a pending request already exists (idempotent)", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([{ userId: "u1", plan: "pro" }]);
    (prisma.orderRequest.count as any).mockResolvedValue(1);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).not.toHaveBeenCalled();
    expect(res.created).toBe(0);
  });

  it("creates a metadata renewal from an active license's plan name", async () => {
    (prisma.license.findMany as any).mockResolvedValue([{ userId: "u2", plan: { name: "Business" } }]);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "u2", product: "metadata", planName: "Business", isRenewal: true },
    });
    expect(res.created).toBe(1);
  });

  it("queries with a cutoff = now + leadDays and paid/active filters", async () => {
    await generateDueRenewals(now, 3);
    const agentWhere = (prisma.agentProfile.findMany as any).mock.calls[0][0].where;
    expect(agentWhere.status).toBe("active");
    expect(agentWhere.plan).toEqual({ in: ["pro", "business"] });
    expect(agentWhere.planExpiresAt.lte instanceof Date).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npm test -- tests/lib/renewals.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/lib/billing/renewals.ts`**

```ts
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_PLANS = ["pro", "business"];

function title(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

async function hasPending(userId: string, product: "agent" | "metadata"): Promise<boolean> {
  const n = await prisma.orderRequest.count({ where: { userId, product, status: "pending" } });
  return n > 0;
}

// Auto-create pending renewal OrderRequests for subscriptions expiring within
// `leadDays` (or already lapsed). Idempotent: skips users who already have a
// pending request for that product. `planExpiresAt/validUntil: { lte }` excludes
// nulls, so free/never-expiring rows are ignored.
export async function generateDueRenewals(
  now: Date = new Date(),
  leadDays = 3
): Promise<{ created: number }> {
  const cutoff = new Date(now.getTime() + leadDays * DAY_MS);
  let created = 0;

  const profiles = await prisma.agentProfile.findMany({
    where: { status: "active", plan: { in: PAID_PLANS }, planExpiresAt: { lte: cutoff } },
    select: { userId: true, plan: true },
  });
  for (const p of profiles) {
    if (await hasPending(p.userId, "agent")) continue;
    await prisma.orderRequest.create({
      data: { userId: p.userId, product: "agent", planName: title(p.plan), isRenewal: true },
    });
    created++;
  }

  const licenses = await prisma.license.findMany({
    where: { status: { in: ["active", "comp"] }, validUntil: { lte: cutoff } },
    select: { userId: true, plan: { select: { name: true } } },
  });
  for (const l of licenses) {
    if (!l.plan?.name) continue;
    if (await hasPending(l.userId, "metadata")) continue;
    await prisma.orderRequest.create({
      data: { userId: l.userId, product: "metadata", planName: l.plan.name, isRenewal: true },
    });
    created++;
  }

  return { created };
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npm test -- tests/lib/renewals.test.ts`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/renewals.ts tests/lib/renewals.test.ts
git commit -m "feat: generate due monthly renewal requests"
```

---

### Task 4: Cron endpoint + schedule

**Files:**
- Create: `src/app/api/billing/renewals/route.ts`
- Modify: `vercel.json`
- Test: `tests/lib/renewals-route.test.ts`

**Interfaces:**
- Consumes: `generateDueRenewals` from `@/lib/billing/renewals`.

- [ ] **Step 1: Write the failing test** — `tests/lib/renewals-route.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/billing/renewals", () => ({ generateDueRenewals: vi.fn() }));

import { GET } from "@/app/api/billing/renewals/route";
import { generateDueRenewals } from "@/lib/billing/renewals";

const OLD = process.env.CRON_SECRET;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  (generateDueRenewals as any).mockResolvedValue({ created: 2 });
});
afterEach(() => {
  process.env.CRON_SECRET = OLD;
});

function req(auth?: string) {
  return new Request("http://test/api/billing/renewals", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("GET /api/billing/renewals", () => {
  it("401 without the correct bearer secret", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect(generateDueRenewals).not.toHaveBeenCalled();
  });
  it("runs the sweep with the correct secret", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, created: 2 });
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npm test -- tests/lib/renewals-route.test.ts`
Expected: FAIL — route module missing.

- [ ] **Step 3: Create `src/app/api/billing/renewals/route.ts`**

```ts
import { NextResponse } from "next/server";
import { generateDueRenewals } from "@/lib/billing/renewals";

export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await generateDueRenewals();
  return NextResponse.json({ ok: true, ...result });
}
```

- [ ] **Step 4: Add the schedule to `vercel.json`**

Add a second entry to the `crons` array (daily 01:00 UTC = 08:00 WIB):

```json
{
  "crons": [
    { "path": "/api/agent/cron", "schedule": "*/5 * * * *" },
    { "path": "/api/billing/renewals", "schedule": "0 1 * * *" }
  ]
}
```

- [ ] **Step 5: Run to verify GREEN**

Run: `npm test -- tests/lib/renewals-route.test.ts`
Expected: PASS (2).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/billing/renewals/route.ts vercel.json tests/lib/renewals-route.test.ts
git commit -m "feat: daily cron endpoint to generate renewal requests"
```

---

### Task 5: Tenant renewal banner on `/finance`

**Files:**
- Modify: `src/lib/orders.ts` (add `listPendingRenewals`)
- Modify: `src/app/finance/page.tsx`

**Interfaces:**
- Produces: `listPendingRenewals(userId: string): Promise<{ id: string; product: string; planName: string }[]>`.

- [ ] **Step 1: Add `listPendingRenewals` to `src/lib/orders.ts`**

```ts
export async function listPendingRenewals(userId: string) {
  return prisma.orderRequest.findMany({
    where: { userId, status: "pending", isRenewal: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, product: true, planName: true },
  });
}
```

- [ ] **Step 2: Show the banner in `src/app/finance/page.tsx`**

Add the import: `import { listPendingRenewals } from "@/lib/orders";` and add `listPendingRenewals(session.user.id)` to the `Promise.all` (destructure as `renewals`).

Immediately inside the top `<div className="mx-auto max-w-3xl ...">`, ABOVE the Finance `<h1>` header row, render:

```tsx
        {renewals.length > 0 && (
          <div className="mb-6 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
            <p className="text-sm font-semibold text-ink">Perpanjangan paket jatuh tempo</p>
            <ul className="mt-2 space-y-1">
              {renewals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {r.product === "agent" ? "Agent WhatsApp" : "Metadata"} — {r.planName}
                  </span>
                  <Link
                    href={`/order/${r.id}`}
                    className="whitespace-nowrap rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition hover:brightness-110"
                  >
                    Upload bukti transfer
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
```

Add `import Link from "next/link";` at the top of the file if not already present.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds. `/finance` shows the gold "Perpanjangan paket jatuh tempo" banner with an upload link when a pending renewal exists.

- [ ] **Step 4: Commit**

```bash
git add src/lib/orders.ts src/app/finance/page.tsx
git commit -m "feat: tenant renewal banner on Finance page"
```

---

### Task 6: "Perpanjangan" badge in admin Orders

**Files:**
- Modify: `src/lib/orders.ts` (`listPendingOrderRequests` select)
- Modify: `src/components/admin/AdminOrdersPanel.tsx`

**Interfaces:**
- Consumes: the `isRenewal` field now returned by `listPendingOrderRequests`.

- [ ] **Step 1: Add `isRenewal` to the list select — `src/lib/orders.ts`**

In `listPendingOrderRequests`, add `isRenewal: true,` to the `select` object (alongside `id`, `product`, `planName`, ...).

- [ ] **Step 2: Show the badge — `src/components/admin/AdminOrdersPanel.tsx`**

Add `isRenewal: boolean;` to the `OrderRow` interface. In the row header, next to the product/plan line, render a badge when it's a renewal:

```tsx
              <p className="font-medium text-ink">
                {order.product === "metadata" ? "Metadata" : "Agent"} — {order.planName}
                {order.isRenewal && (
                  <span className="ml-2 rounded-full bg-brand-blue/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3B65C4] ring-1 ring-brand-blue/30">
                    Perpanjangan
                  </span>
                )}
              </p>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds; `/admin/orders` shows a "Perpanjangan" badge on renewal requests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/orders.ts src/components/admin/AdminOrdersPanel.tsx
git commit -m "feat: mark renewal requests in admin Orders"
```

---

## Self-Review Notes

- **Spec coverage:** `isRenewal` + forward-stacking helpers (Task 1); renewal-aware fulfillment + grantLicense override (Task 2); due-renewal generation (Task 3); cron endpoint + schedule (Task 4); tenant upload banner (Task 5); admin renewal marker (Task 6). Testing section maps to Tasks 1–4.
- **Deferred (per spec):** payment gateway, auto-fulfill, metadata enforcement, reminders, extra downgrade logic.
- **Type consistency:** `renewedExpiryFrom`/`addOneMonthJakarta` (Task 1) consumed in Task 2; `GrantOptions.validUntil` (Task 2) consumed by fulfill's metadata branch; `isRenewal` column (Task 1) read by Tasks 2/3/5/6; `generateDueRenewals` (Task 3) consumed by Task 4.
- **First-vs-renewal:** first activation still `monthlyExpiryFrom`; only `order.isRenewal` fulfillment stacks +1 month — matches the confirmed decision.
- **Idempotency:** cron dedups on an existing pending request per user+product.
