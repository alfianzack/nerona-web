# Tenant Points & Finance Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a per-tenant points balance on the admin user detail page, add a Finance tab (points ledger + purchase history), let admins adjust points, and make the WhatsApp agent meter each AI call against the balance — blocking calls at zero.

**Architecture:** A new append-only `PointTransaction` ledger; balance = sum of signed deltas. A `lib/points.ts` service (get/adjust/spend/list) is the single source of truth shared by the admin API route, the detail page, and the agent. The agent meters cost from token usage × a per-model USD price table (`lib/agent/pricing.ts`), converted to points at `POINTS_PER_USD`. The detail page becomes a server component that loads balance/ledger/purchases and renders a tabbed client UI.

**Tech Stack:** Next.js 14 (App Router, server + client components), Prisma 5 + PostgreSQL, next-auth, Tailwind, Vitest.

## Global Constraints

- Admin API routes guard with `getServerSession(authOptions)` then `if (!session?.user?.role) → 401`; pages use `requireAdmin()` from `@/lib/session-guards`.
- All user-facing copy is Indonesian, matching the existing admin (e.g. "Poin", "Sesuaikan poin", "Pembelian").
- Import alias `@/` → `src/`. Tests live in `tests/**/*.test.ts` and mock `@/lib/prisma`.
- Money/points are whole integers. Points display via `toLocaleString("id-ID")` (e.g. "1.250 poin").
- Manual adjustments can never drive the balance below 0. Agent spend is post-facto and may go slightly negative; the pre-call gate blocks the next call at `balance <= 0`.
- `POINTS_PER_USD` default `100_000`; per-reply point cost is `max(1, ceil(usd * POINTS_PER_USD))`.
- Agent default model: `process.env.AGENT_MODEL || "gemini-2.0-flash-lite"`.
- Price numbers in the table are placeholders — confirm against the provider's real rates during implementation.

---

### Task 1: PointTransaction model, migration, and `lib/points.ts`

**Files:**
- Modify: `prisma/schema.prisma` (add model + two `User` back-relations)
- Create: `src/lib/points.ts`
- Test: `tests/lib/points.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces:
  - `getBalance(userId: string): Promise<number>`
  - `listTransactions(userId: string, take?: number): Promise<PointTransactionView[]>` where `PointTransactionView = { id: string; delta: number; reason: string; note: string | null; createdByName: string | null; createdAt: Date }`
  - `adjustPoints(p: { userId: string; delta: number; note?: string; createdById: string }): Promise<{ ok: true; balance: number } | { ok: false; reason: "below_zero" }>`
  - `spendPoints(p: { userId: string; cost: number; note?: string }): Promise<number>` (returns new balance)

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Append this model (after `ShopOrderItem`):

```prisma
model PointTransaction {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation("UserPointTransactions", fields: [userId], references: [id], onDelete: Cascade)
  delta       Int      // signed: positive = credit, negative = debit
  reason      String   // "manual_adjust" | "spend" (future: "topup")
  note        String?
  createdById String?
  createdBy   User?    @relation("PointAdjustedByAdmin", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())

  @@index([userId])
  @@map("point_transactions")
}
```

Add these two lines to the `User` model's relation block (next to `shopOrders`):

```prisma
  pointTransactions         PointTransaction[] @relation("UserPointTransactions")
  adjustedPointTransactions PointTransaction[] @relation("PointAdjustedByAdmin")
```

- [ ] **Step 2: Create and apply the migration**

Run: `npm run prisma:migrate -- --name add_point_transactions`
Expected: a new folder under `prisma/migrations/` and "Your database is now in sync". Prisma Client regenerates so `prisma.pointTransaction` is typed.

- [ ] **Step 3: Write the failing test** — `tests/lib/points.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pointTransaction: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { getBalance, adjustPoints, spendPoints, listTransactions } from "@/lib/points";
import { prisma } from "@/lib/prisma";

beforeEach(() => vi.clearAllMocks());

describe("getBalance", () => {
  it("returns the summed delta", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: 1250 } });
    expect(await getBalance("u1")).toBe(1250);
  });

  it("returns 0 when the ledger is empty", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: null } });
    expect(await getBalance("u1")).toBe(0);
  });
});

describe("adjustPoints", () => {
  it("creates a manual_adjust row and returns the new balance", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: 100 } });
    const res = await adjustPoints({ userId: "u1", delta: 50, note: "bonus", createdById: "admin1" });
    expect(res).toEqual({ ok: true, balance: 150 });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: 50, reason: "manual_adjust", note: "bonus", createdById: "admin1" },
    });
  });

  it("rejects an adjustment that would go below zero", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: 20 } });
    const res = await adjustPoints({ userId: "u1", delta: -50, createdById: "admin1" });
    expect(res).toEqual({ ok: false, reason: "below_zero" });
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });
});

describe("spendPoints", () => {
  it("always writes a negative spend row and returns the new balance", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: -5 } });
    const bal = await spendPoints({ userId: "u1", cost: 10, note: "AI reply" });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: -10, reason: "spend", note: "AI reply", createdById: null },
    });
    expect(bal).toBe(-5);
  });
});

describe("listTransactions", () => {
  it("maps rows to views with the admin name", async () => {
    (prisma.pointTransaction.findMany as any).mockResolvedValue([
      { id: "t1", delta: 50, reason: "manual_adjust", note: "bonus", createdAt: new Date("2026-07-23"), createdBy: { name: "Fahmi", email: "f@x.com" } },
    ]);
    const rows = await listTransactions("u1");
    expect(rows[0]).toMatchObject({ id: "t1", delta: 50, createdByName: "Fahmi" });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- tests/lib/points.test.ts`
Expected: FAIL — cannot find module `@/lib/points`.

- [ ] **Step 5: Create `src/lib/points.ts`**

```ts
import { prisma } from "@/lib/prisma";

export interface PointTransactionView {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export async function getBalance(userId: string): Promise<number> {
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

export async function listTransactions(userId: string, take = 50): Promise<PointTransactionView[]> {
  const rows = await prisma.pointTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    note: r.note,
    createdByName: r.createdBy?.name ?? r.createdBy?.email ?? null,
    createdAt: r.createdAt,
  }));
}

export type AdjustResult = { ok: true; balance: number } | { ok: false; reason: "below_zero" };

export async function adjustPoints(params: {
  userId: string;
  delta: number;
  note?: string;
  createdById: string;
}): Promise<AdjustResult> {
  const current = await getBalance(params.userId);
  if (current + params.delta < 0) {
    return { ok: false, reason: "below_zero" };
  }
  await prisma.pointTransaction.create({
    data: {
      userId: params.userId,
      delta: params.delta,
      reason: "manual_adjust",
      note: params.note ?? null,
      createdById: params.createdById,
    },
  });
  return { ok: true, balance: current + params.delta };
}

export async function spendPoints(params: {
  userId: string;
  cost: number;
  note?: string;
}): Promise<number> {
  await prisma.pointTransaction.create({
    data: {
      userId: params.userId,
      delta: -Math.abs(params.cost),
      reason: "spend",
      note: params.note ?? null,
      createdById: null,
    },
  });
  return getBalance(params.userId);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/lib/points.test.ts`
Expected: PASS (all 6).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/points.ts tests/lib/points.test.ts
git commit -m "feat: point transaction ledger and points service"
```

---

### Task 2: `lib/agent/pricing.ts` — token→points cost

**Files:**
- Create: `src/lib/agent/pricing.ts`
- Test: `tests/lib/agent/pricing.test.ts`

**Interfaces:**
- Produces:
  - `TokenUsage = { promptTokens: number; completionTokens: number }`
  - `costForUsage(p: { model: string; usage: TokenUsage | null }): number` (integer ≥ 1)

- [ ] **Step 1: Write the failing test** — `tests/lib/agent/pricing.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { costForUsage } from "@/lib/agent/pricing";

afterEach(() => {
  delete process.env.POINTS_PER_USD;
  vi.restoreAllMocks();
});

describe("costForUsage", () => {
  it("computes ceil(usd * POINTS_PER_USD) for a known model", () => {
    // gemini-2.0-flash-lite: in $0.075/M, out $0.30/M
    // usd = 1500/1e6*0.075 + 350/1e6*0.30 = 0.0001125 + 0.000105 = 0.0002175
    // points = ceil(0.0002175 * 100000) = ceil(21.75) = 22
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: { promptTokens: 1500, completionTokens: 350 } });
    expect(cost).toBe(22);
  });

  it("respects a POINTS_PER_USD override", () => {
    process.env.POINTS_PER_USD = "1000000";
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: { promptTokens: 1500, completionTokens: 350 } });
    expect(cost).toBe(218); // ceil(0.0002175 * 1e6) = ceil(217.5)
  });

  it("falls back to the default price for an unknown model", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cost = costForUsage({ model: "mystery-model", usage: { promptTokens: 1500, completionTokens: 350 } });
    expect(cost).toBe(22); // same as flash-lite default
    expect(warn).toHaveBeenCalled();
  });

  it("charges a minimum of 1 point for tiny usage", () => {
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: { promptTokens: 1, completionTokens: 1 } });
    expect(cost).toBe(1);
  });

  it("charges a conservative default when usage is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: null });
    expect(cost).toBeGreaterThanOrEqual(1);
    expect(warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/agent/pricing.test.ts`
Expected: FAIL — cannot find module `@/lib/agent/pricing`.

- [ ] **Step 3: Create `src/lib/agent/pricing.ts`**

```ts
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

interface ModelPrice {
  in: number; // USD per 1,000,000 input tokens
  out: number; // USD per 1,000,000 output tokens
}

// Placeholder rates — confirm against the provider's real pricing.
const MODEL_PRICES: Record<string, ModelPrice> = {
  "gemini-2.0-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-2.0-flash": { in: 0.1, out: 0.4 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
};

const DEFAULT_PRICE = MODEL_PRICES["gemini-2.0-flash-lite"];

function pointsPerUsd(): number {
  const v = Number(process.env.POINTS_PER_USD);
  return Number.isFinite(v) && v > 0 ? v : 100_000;
}

export function costForUsage(params: { model: string; usage: TokenUsage | null }): number {
  const price = MODEL_PRICES[params.model] ?? DEFAULT_PRICE;
  if (params.model && !MODEL_PRICES[params.model]) {
    console.warn(`[pricing] unknown model "${params.model}", using default price`);
  }
  const usage = params.usage;
  if (!usage || (usage.promptTokens <= 0 && usage.completionTokens <= 0)) {
    console.warn("[pricing] missing token usage, charging conservative default cost");
    const fallbackUsd = (1000 / 1e6) * price.out; // price a ~1k-token reply
    return Math.max(1, Math.ceil(fallbackUsd * pointsPerUsd()));
  }
  const usd = (usage.promptTokens / 1e6) * price.in + (usage.completionTokens / 1e6) * price.out;
  return Math.max(1, Math.ceil(usd * pointsPerUsd()));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent/pricing.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/pricing.ts tests/lib/agent/pricing.test.ts
git commit -m "feat: token-usage to points cost model with per-model prices"
```

---

### Task 3: `generateReply` returns usage + model; default to cheapest model

**Files:**
- Modify: `src/lib/agent/claude-client.ts`
- Test: `tests/lib/agent/claude-client.test.ts` (update)

**Interfaces:**
- Produces: `GenerateReplyResult = { text: string; model: string; usage: { promptTokens: number; completionTokens: number } | null }`; `generateReply(params): Promise<GenerateReplyResult>` (params unchanged).

- [ ] **Step 1: Update the test** — replace the three assertions on the returned string in `tests/lib/agent/claude-client.test.ts`

First test — change the mocked response and the assertion:

```ts
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Halo! Ada yang bisa saya bantu?" } }],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(result.text).toBe("Halo! Ada yang bisa saya bantu?");
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 8 });
    expect(result.model).toBeTruthy();
```

Second test ("no content") — assert on `.text` and null usage:

```ts
    const result = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(result.text).toBe("");
    expect(result.usage).toBeNull();
```

The third test (throws on error) is unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/agent/claude-client.test.ts`
Expected: FAIL — `result.text` undefined (function still returns a string).

- [ ] **Step 3: Update `src/lib/agent/claude-client.ts`**

Change the model default and the return. Full updated file:

```ts
const MODEL = process.env.AGENT_MODEL || "gemini-2.0-flash-lite";
const BASE_URL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";

export interface GenerateReplyResult {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
}

export async function generateReply(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<GenerateReplyResult> {
  const apiKey = process.env.SUMOPOD_API_KEY;

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "system", content: params.systemPrompt }, ...params.history],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sumopod chat completion failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      }
    : null;
  return { text, model: MODEL, usage };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent/claude-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/claude-client.ts tests/lib/agent/claude-client.test.ts
git commit -m "feat: generateReply returns token usage and model; default gemini-flash-lite"
```

---

### Task 4: Agent gate + spend in `process-job.ts`

**Files:**
- Modify: `src/lib/agent/process-job.ts`
- Test: `tests/lib/agent/process-job.test.ts` (update mocks + add cases)

**Interfaces:**
- Consumes: `getBalance`, `spendPoints` from `@/lib/points`; `costForUsage` from `@/lib/agent/pricing`; `GenerateReplyResult` from `@/lib/agent/claude-client`.

- [ ] **Step 1: Update the test file mocks and happy-path setup** — `tests/lib/agent/process-job.test.ts`

Add mocks for the new deps (after the existing `vi.mock` calls):

```ts
vi.mock("@/lib/points", () => ({
  getBalance: vi.fn(),
  spendPoints: vi.fn(),
}));
vi.mock("@/lib/agent/pricing", () => ({
  costForUsage: vi.fn(() => 22),
}));
```

Add the imports:

```ts
import { getBalance, spendPoints } from "@/lib/points";
import { costForUsage } from "@/lib/agent/pricing";
```

Add `userId` to the `profile` fixture:

```ts
const profile = {
  id: "profile-1",
  userId: "user-1",
  whatsappPhone: "+15551234567",
  businessName: "Toko A",
  timezone: "Asia/Jakarta",
};
```

In the happy-path `beforeEach`, set a positive balance and object reply:

```ts
    (getBalance as any).mockResolvedValue(500);
    (generateReply as any).mockResolvedValue({
      text: "Halo juga!",
      model: "gemini-2.0-flash-lite",
      usage: { promptTokens: 20, completionTokens: 10 },
    });
```

In the happy-path assertion test, add:

```ts
    expect(spendPoints).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", cost: 22 })
    );
```

- [ ] **Step 2: Add the gate test** (new `describe` block at the end of the file)

```ts
describe("processJob — out of points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (beginProcessing as any).mockResolvedValue({ id: "job-1", profileId: "profile-1", attempts: 1 });
    (prisma.agentProfile.findUnique as any).mockResolvedValue(profile);
    (getBalance as any).mockResolvedValue(0);
  });

  it("does not call the AI, sends poin-habis, and completes without spending", async () => {
    await processJob("job-1");

    expect(generateReply).not.toHaveBeenCalled();
    expect(spendPoints).not.toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith("+15551234567", expect.stringContaining("poin"));
    expect(completeJob).toHaveBeenCalledWith("job-1");
    expect(failJob).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/lib/agent/process-job.test.ts`
Expected: FAIL — `getBalance` not used by `processJob` yet; `reply` is an object now so `sendWhatsAppText` gets `[object Object]`.

- [ ] **Step 4: Update `src/lib/agent/process-job.ts`**

Add imports at the top:

```ts
import { getBalance, spendPoints } from "@/lib/points";
import { costForUsage } from "./pricing";
```

Add the out-of-points message constant near `FAILURE_APOLOGY`:

```ts
const OUT_OF_POINTS =
  "Maaf, poin kamu sudah habis. Silakan isi ulang poin untuk melanjutkan pakai asisten AI.";
```

Replace the body of the `try` block (from the profile lookup through `completeJob`) with:

```ts
    const profile = await prisma.agentProfile.findUnique({ where: { id: job.profileId } });
    if (!profile || !profile.whatsappPhone) {
      throw new Error(`AgentProfile ${job.profileId} not found or has no phone`);
    }

    // Gate: refuse the AI call when the wallet is empty.
    const balance = await getBalance(profile.userId);
    if (balance <= 0) {
      await sendWhatsAppText(profile.whatsappPhone, OUT_OF_POINTS);
      await logOutbound({ profileId: profile.id, phone: profile.whatsappPhone, body: OUT_OF_POINTS });
      await completeJob(jobId);
      return;
    }

    const [facts, history] = await Promise.all([
      listRecentFacts(profile.id),
      getRecentHistory(profile.id, 20),
    ]);

    const systemPrompt = buildSystemPrompt({
      businessName: profile.businessName,
      timezone: profile.timezone,
      facts,
    });

    const result = await generateReply({
      systemPrompt,
      history: toClaudeHistory(history),
    });

    await sendWhatsAppText(profile.whatsappPhone, result.text);
    await logOutbound({ profileId: profile.id, phone: profile.whatsappPhone, body: result.text });

    // Meter the call against the wallet (best-effort; a failure here must not
    // undo the reply that already went out).
    try {
      const cost = costForUsage({ model: result.model, usage: result.usage });
      await spendPoints({
        userId: profile.userId,
        cost,
        note: `AI reply · ${result.model} · ${result.usage?.promptTokens ?? 0}+${result.usage?.completionTokens ?? 0} tok`,
      });
    } catch (spendErr) {
      console.error("[process-job] spendPoints failed", spendErr);
    }

    await completeJob(jobId);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent/process-job.test.ts`
Expected: PASS (happy path, gate, and existing failure cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/process-job.ts tests/lib/agent/process-job.test.ts
git commit -m "feat: agent gates AI calls on points and meters cost per reply"
```

---

### Task 5: `POST /api/admin/points`

**Files:**
- Create: `src/app/api/admin/points/route.ts`
- Test: `tests/lib/points-route.test.ts`

**Interfaces:**
- Consumes: `adjustPoints` from `@/lib/points`, `prisma`, `authOptions`.
- Produces: `POST` accepting `{ userId?: string; userEmail?: string; delta: number; note?: string }` → `{ ok: true, balance }` or an error with status.

- [ ] **Step 1: Write the failing test** — `tests/lib/points-route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/points", () => ({ adjustPoints: vi.fn() }));

import { POST } from "@/app/api/admin/points/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { adjustPoints } from "@/lib/points";

function req(body: unknown) {
  return new Request("http://test/api/admin/points", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/admin/points", () => {
  it("401 when the caller is not an admin", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(req({ userId: "u1", delta: 10 }));
    expect(res.status).toBe(401);
  });

  it("400 when delta is zero or not an integer", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    expect((await POST(req({ userId: "u1", delta: 0 }))).status).toBe(400);
    expect((await POST(req({ userId: "u1", delta: 1.5 }))).status).toBe(400);
  });

  it("404 when the user cannot be resolved", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(req({ userEmail: "missing@x.com", delta: 10 }));
    expect(res.status).toBe(404);
  });

  it("400 when the adjustment would go below zero", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (adjustPoints as any).mockResolvedValue({ ok: false, reason: "below_zero" });
    const res = await POST(req({ userId: "u1", delta: -10 }));
    expect(res.status).toBe(400);
  });

  it("returns the new balance on success", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (adjustPoints as any).mockResolvedValue({ ok: true, balance: 150 });
    const res = await POST(req({ userId: "u1", delta: 50, note: "bonus" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, balance: 150 });
    expect(adjustPoints).toHaveBeenCalledWith({ userId: "u1", delta: 50, note: "bonus", createdById: "a1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/points-route.test.ts`
Expected: FAIL — cannot find module `@/app/api/admin/points/route`.

- [ ] **Step 3: Create `src/app/api/admin/points/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustPoints } from "@/lib/points";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const delta = Number(body?.delta);
  if (!Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ ok: false, message: "Jumlah poin tidak valid." }, { status: 400 });
  }

  let userId: string | undefined = body?.userId;
  if (!userId && body?.userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: body.userEmail },
      select: { id: true },
    });
    userId = user?.id;
  }
  if (!userId) {
    return NextResponse.json({ ok: false, message: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  const result = await adjustPoints({
    userId,
    delta,
    note: body?.note || undefined,
    createdById: session.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: "Saldo poin tidak boleh minus." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, balance: result.balance });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/points-route.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/points/route.ts tests/lib/points-route.test.ts
git commit -m "feat: admin points adjust endpoint"
```

---

### Task 6: Detail page server load + header + tabs shell

**Files:**
- Modify: `src/app/admin/users/[id]/page.tsx`
- Create: `src/components/admin/UserDetailTabs.tsx`

**Interfaces:**
- Consumes: `getBalance`, `listTransactions` from `@/lib/points`; `prisma`.
- Produces (serialized props passed to `UserDetailTabs`, then to `UserFinancePanel` in Task 7):
  - `TxnView = { id: string; delta: number; reason: string; note: string | null; createdByName: string | null; createdAt: string }` (ISO string)
  - `PurchaseView = { id: string; kind: "plan" | "order"; label: string; detail: string | null; amount: number | null; date: string }` (ISO string)
  - `UserDetailTabs` props: `{ userEmail: string; userId: string; balance: number; transactions: TxnView[]; purchases: PurchaseView[] }`

- [ ] **Step 1: Rewrite `src/app/admin/users/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { UserDetailTabs, type PurchaseView } from "@/components/admin/UserDetailTabs";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    notFound();
  }

  const [balance, txns, orderRequests, orders] = await Promise.all([
    getBalance(user.id),
    listTransactions(user.id),
    prisma.orderRequest.findMany({
      where: { userId: user.id, status: "fulfilled" },
      orderBy: { fulfilledAt: "desc" },
      select: { id: true, product: true, planName: true, fulfilledAt: true },
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, currency: true, note: true, courseId: true, createdAt: true },
    }),
  ]);

  const purchases: PurchaseView[] = [
    ...orderRequests.map((o) => ({
      id: `req-${o.id}`,
      kind: "plan" as const,
      label: `${o.product === "agent" ? "Agent" : "Metadata"} — ${o.planName}`,
      detail: null,
      amount: null,
      date: (o.fulfilledAt ?? new Date(0)).toISOString(),
    })),
    ...orders.map((o) => ({
      id: `ord-${o.id}`,
      kind: "order" as const,
      label: o.courseId ? "Pembelian kelas" : "Aktivasi lisensi",
      detail: o.note,
      amount: o.amount,
      date: o.createdAt.toISOString(),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const transactions = txns.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }));

  return (
    <div className="max-w-2xl">
      <Link href="/admin/users" className="text-sm text-brand-blue hover:underline">
        ‹ Kembali ke daftar pengguna
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{user.name ?? user.email}</h2>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-sm font-semibold text-navy-900">
          {balance.toLocaleString("id-ID")} poin
        </span>
      </div>

      <div className="mt-6">
        <UserDetailTabs
          userEmail={user.email}
          userId={user.id}
          balance={balance}
          transactions={transactions}
          purchases={purchases}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/admin/UserDetailTabs.tsx`** (tabs shell; Finance content lands in Task 7)

```tsx
"use client";

import { useState } from "react";
import { UserPlanManager } from "@/components/admin/UserPlanManager";
import { UserFinancePanel } from "@/components/admin/UserFinancePanel";

export interface TxnView {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PurchaseView {
  id: string;
  kind: "plan" | "order";
  label: string;
  detail: string | null;
  amount: number | null;
  date: string;
}

type Tab = "paket" | "finance";

const TABS: { key: Tab; label: string }[] = [
  { key: "paket", label: "Paket" },
  { key: "finance", label: "Finance" },
];

export function UserDetailTabs(props: {
  userEmail: string;
  userId: string;
  balance: number;
  transactions: TxnView[];
  purchases: PurchaseView[];
}) {
  const [tab, setTab] = useState<Tab>("paket");

  return (
    <div>
      <div className="flex gap-1.5 border-b border-navy-900/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "border-b-2 border-gold-400 text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "paket" ? (
          <UserPlanManager userEmail={props.userEmail} />
        ) : (
          <UserFinancePanel
            userId={props.userId}
            initialBalance={props.balance}
            initialTransactions={props.transactions}
            purchases={props.purchases}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add a temporary stub so the app compiles before Task 7**

Create `src/components/admin/UserFinancePanel.tsx` with a minimal stub (replaced in Task 7):

```tsx
"use client";
import type { PurchaseView, TxnView } from "@/components/admin/UserDetailTabs";
export function UserFinancePanel(_props: {
  userId: string;
  initialBalance: number;
  initialTransactions: TxnView[];
  purchases: PurchaseView[];
}) {
  return <p className="text-sm text-muted">Finance…</p>;
}
```

- [ ] **Step 4: Verify it builds and type-checks**

Run: `npm run build`
Expected: build succeeds (no type errors); the detail page shows the header with the points chip and the two tabs, Paket renders the existing plan manager.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/users/[id]/page.tsx src/components/admin/UserDetailTabs.tsx src/components/admin/UserFinancePanel.tsx
git commit -m "feat: user detail header with points chip and Paket/Finance tabs"
```

---

### Task 7: `UserFinancePanel` — points ledger, adjust form, purchases

**Files:**
- Modify: `src/components/admin/UserFinancePanel.tsx` (replace the Task 6 stub)

**Interfaces:**
- Consumes: `TxnView`, `PurchaseView` from `@/components/admin/UserDetailTabs`; `POST /api/admin/points`.

- [ ] **Step 1: Replace `src/components/admin/UserFinancePanel.tsx` with the full component**

```tsx
"use client";

import { useState } from "react";
import type { PurchaseView, TxnView } from "@/components/admin/UserDetailTabs";

const cardClass =
  "rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10";
const inputClass =
  "rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";
const primaryBtn =
  "rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function reasonLabel(reason: string): string {
  if (reason === "manual_adjust") return "Penyesuaian admin";
  if (reason === "spend") return "Pemakaian AI";
  if (reason === "topup") return "Top-up";
  return reason;
}

export function UserFinancePanel(props: {
  userId: string;
  initialBalance: number;
  initialTransactions: TxnView[];
  purchases: PurchaseView[];
}) {
  const [balance, setBalance] = useState(props.initialBalance);
  const [transactions, setTransactions] = useState<TxnView[]>(props.initialTransactions);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"add" | "sub">("add");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const magnitude = Math.round(Number(amount));
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      setError("Masukkan jumlah poin yang valid.");
      return;
    }
    const delta = direction === "add" ? magnitude : -magnitude;

    setLoading(true);
    const res = await fetch("/api/admin/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: props.userId, delta, note: note.trim() || undefined }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menyesuaikan poin.");
      return;
    }

    setBalance(data.balance);
    setTransactions((prev) => [
      {
        id: `optimistic-${prev.length}-${delta}`,
        delta,
        reason: "manual_adjust",
        note: note.trim() || null,
        createdByName: "Kamu",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setAmount("");
    setNote("");
  }

  return (
    <div className="space-y-5">
      <section className={cardClass}>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-ink">Poin</h3>
          <span className="text-lg font-semibold tabular-nums text-ink">
            {balance.toLocaleString("id-ID")} poin
          </span>
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Aksi
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "add" | "sub")}
              className={inputClass}
            >
              <option value="add">Tambah</option>
              <option value="sub">Kurangi</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Jumlah
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${inputClass} w-28`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            Catatan (opsional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="mis. bonus promo"
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={loading} className={primaryBtn}>
            {loading ? "..." : "Simpan"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Riwayat poin</h4>
          {transactions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada transaksi poin.</p>
          ) : (
            <ul className="mt-2 divide-y divide-navy-900/10">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {reasonLabel(t.reason)}
                      {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {fmtDate(t.createdAt)}
                      {t.createdByName ? ` · ${t.createdByName}` : ""}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                      t.delta >= 0 ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {t.delta >= 0 ? "+" : ""}
                    {t.delta.toLocaleString("id-ID")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-sm font-semibold text-ink">Pembelian</h3>
        {props.purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada pembelian.</p>
        ) : (
          <ul className="mt-2 divide-y divide-navy-900/10">
            {props.purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{p.label}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(p.date)}
                    {p.detail ? ` · ${p.detail}` : ""}
                  </p>
                </div>
                {p.amount != null && (
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-ink">
                    Rp {p.amount.toLocaleString("id-ID")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds and type-checks**

Run: `npm run build`
Expected: build succeeds. The Finance tab shows the balance, the "Tambah/Kurangi" adjust form, the point history, and the purchases list.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, sign in as an admin, open `/admin/users/<some-user-id>`.
Expected: header shows the points chip; Finance tab adjusts points (a positive adjust raises the balance and prepends a row; trying to subtract more than the balance shows "Saldo poin tidak boleh minus."); Pembelian lists any fulfilled Pro/Business activations and rupiah orders.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/UserFinancePanel.tsx
git commit -m "feat: finance panel with points ledger, adjust form, and purchases"
```

---

## Self-Review Notes

- **Spec coverage:** ledger model + balance (Task 1); floor guard (Task 1 + 5); token×price cost model + cheapest-model default (Tasks 2–3); agent gate + spend + poin-habis + best-effort deduction (Task 4); adjust endpoint with all error codes (Task 5); server-loaded balance/ledger/purchases, header points chip, Paket/Finance tabs (Task 6); Poin section with adjust form + history and Pembelian list (Task 7). Testing section of the spec maps to Tasks 1, 2, 4, 5.
- **Deferred (per spec "Not doing"):** cached balance, self-serve top-up, editable price UI, model fallback, non-agent metering, strict never-negative concurrency, points on the users list, USD/rupiah value shown to tenants.
- **Type consistency:** `TxnView`/`PurchaseView` are defined once in `UserDetailTabs.tsx` and imported by page + panel; `GenerateReplyResult` (Task 3) is consumed in Task 4; `costForUsage`/`getBalance`/`spendPoints`/`adjustPoints` signatures match across producer and consumer tasks.
