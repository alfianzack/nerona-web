# Nerona Agent — Sistem Poin Pemakaian Model AI: Implementation Plan

> **SUPERSEDED (2026-07-23):** Never executed. Replaced by
> `docs/superpowers/plans/2026-07-23-tenant-points-finance-tab.md` (prepaid-wallet
> design). Do NOT implement this plan. Kept for reference only.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti kuota "pesan/bulan" agent dengan kuota "poin/bulan" per paket, di mana tiap tenant memilih model AI lintas provider (Sumopod) dan tiap balasan memotong poin sesuai model.

**Architecture:** Semua logika bisnis di modul kecil `src/lib/agent/`, route API tetap adapter tipis (pola repo). Katalog model + tarif poin + jatah adalah konstanta kode di `models.ts`. Pelacakan pakai penjumlahan poin per bulan dari kolom baru `AgentMessage.points` (tanpa cron refill). Model pilihan tenant disimpan di `AgentProfile.agentModel`.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Prisma 5 + Vitest. AI via gateway Sumopod (OpenAI-compatible) yang sudah terpasang di `claude-client.ts`.

## Global Constraints

- Semua query data agent di-scope `profileId` (isolasi tenant di kode).
- Konfigurasi paket agent = konstanta kode, bukan tabel `Plan` DB (itu domain lisensi extension).
- Id model harus persis id Sumopod: `gpt-4o-mini`, `gemini/gemini-2.5-flash`, `MiniMax-M3`, `claude-haiku-4-5`, `gpt-5`, `claude-sonnet-5`, `gemini/gemini-3.1-pro-preview`, `gpt-5.4`, `claude-opus-4-8`.
- Tarif poin: 1/1/1/2/3/4/4/6/10 (urutan id di atas). Plafon akses paket: Free ≤ 2, Pro ≤ 4, Business = semua. Jatah poin/bulan: Free 50, Pro 500, Business 1500.
- Poin hanya dipotong pada balasan AI yang berhasil (bukan balasan statis, bukan pesan masuk, bukan retry gagal).
- Prisma CLI selalu lewat `npm run prisma:*` (memuat `.env.local`).
- Commit dengan path file eksplisit (working tree memuat perubahan lain yang belum di-commit — jangan `git add -A`).

---

### Task 1: Skema Prisma — kolom model & poin

**Files:**
- Modify: `prisma/schema.prisma` (model `AgentProfile`, model `AgentMessage`)

**Interfaces:**
- Produces: kolom `AgentProfile.agentModel: String` (default `"claude-haiku-4-5"`) dan `AgentMessage.points: Int` (default `0`). Dipakai Task 3, 5, 6, 7, 9.

- [ ] **Step 1: Tambah `agentModel` ke `AgentProfile`**

Di `prisma/schema.prisma`, pada model `AgentProfile`, setelah baris `plan String @default("free") // ...` tambahkan:

```prisma
  agentModel          String    @default("claude-haiku-4-5") // id model katalog pilihan tenant
```

- [ ] **Step 2: Tambah `points` ke `AgentMessage`**

Di model `AgentMessage`, setelah baris `body String @db.Text` tambahkan:

```prisma
  points      Int           @default(0) // poin dipotong; diisi hanya pada balasan AI (direction "out")
```

- [ ] **Step 3: Jalankan migrasi**

Run: `npm run prisma:migrate -- --name agent_ai_points`
Expected: output diakhiri `Your database is now in sync with your schema.` dan folder migrasi baru dibuat.

- [ ] **Step 4: Verifikasi type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add agentModel and message points columns for AI usage points"
```

---

### Task 2: Katalog model & konfigurasi poin

**Files:**
- Create: `src/lib/agent/models.ts`
- Test: `tests/lib/agent/models.test.ts`

**Interfaces:**
- Produces:
  - `interface AgentModel { id: string; label: string; provider: string; points: number }`
  - `AGENT_MODELS: AgentModel[]`
  - `DEFAULT_MODEL = "claude-haiku-4-5"`
  - `pointCostFor(modelId: string): number` (melempar error untuk id tak dikenal)
  - `isModelAllowedForPlan(plan: string, modelId: string): boolean` (id tak dikenal → `false`, tidak melempar)
  - `modelsForPlan(plan: string): AgentModel[]`
  - `defaultModelForPlan(plan: string): string`
  - `monthlyPointsFor(plan: string): number | null`
- Dikonsumsi: Task 3 (`monthlyPointsFor`), Task 6/7 (`pointCostFor`, `isModelAllowedForPlan`, `defaultModelForPlan`), Task 8 (`isModelAllowedForPlan`, `defaultModelForPlan`), Task 9 (`isModelAllowedForPlan`, `modelsForPlan`, `monthlyPointsFor`).

- [ ] **Step 1: Tulis test yang gagal**

Create `tests/lib/agent/models.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AGENT_MODELS,
  DEFAULT_MODEL,
  defaultModelForPlan,
  isModelAllowedForPlan,
  modelsForPlan,
  monthlyPointsFor,
  pointCostFor,
} from "@/lib/agent/models";

describe("pointCostFor", () => {
  it("returns the point cost of a known model", () => {
    expect(pointCostFor("claude-haiku-4-5")).toBe(2);
    expect(pointCostFor("claude-opus-4-8")).toBe(10);
    expect(pointCostFor("gpt-4o-mini")).toBe(1);
  });

  it("throws for an unknown model", () => {
    expect(() => pointCostFor("no-such-model")).toThrow(/unknown/i);
  });
});

describe("isModelAllowedForPlan", () => {
  it("allows models at or below the plan ceiling", () => {
    expect(isModelAllowedForPlan("free", "claude-haiku-4-5")).toBe(true); // 2 <= 2
    expect(isModelAllowedForPlan("pro", "claude-sonnet-5")).toBe(true); // 4 <= 4
    expect(isModelAllowedForPlan("business", "claude-opus-4-8")).toBe(true);
  });

  it("blocks models above the plan ceiling", () => {
    expect(isModelAllowedForPlan("free", "gpt-5")).toBe(false); // 3 > 2
    expect(isModelAllowedForPlan("pro", "gpt-5.4")).toBe(false); // 6 > 4
  });

  it("returns false (never throws) for an unknown model", () => {
    expect(isModelAllowedForPlan("business", "no-such-model")).toBe(false);
  });

  it("treats an unknown plan as free", () => {
    expect(isModelAllowedForPlan("mystery", "gpt-5")).toBe(false); // 3 > 2
    expect(isModelAllowedForPlan("mystery", "gpt-4o-mini")).toBe(true); // 1 <= 2
  });
});

describe("modelsForPlan", () => {
  it("returns only models within the plan ceiling", () => {
    const free = modelsForPlan("free").map((m) => m.id);
    expect(free).toEqual(["gpt-4o-mini", "gemini/gemini-2.5-flash", "MiniMax-M3", "claude-haiku-4-5"]);

    const business = modelsForPlan("business");
    expect(business.length).toBe(AGENT_MODELS.length);
  });
});

describe("defaultModelForPlan", () => {
  it("returns the universal default (allowed by every plan)", () => {
    expect(defaultModelForPlan("free")).toBe(DEFAULT_MODEL);
    expect(isModelAllowedForPlan("free", defaultModelForPlan("free"))).toBe(true);
  });
});

describe("monthlyPointsFor", () => {
  it("maps known plans to their monthly point allowance", () => {
    expect(monthlyPointsFor("free")).toBe(50);
    expect(monthlyPointsFor("pro")).toBe(500);
    expect(monthlyPointsFor("business")).toBe(1500);
  });

  it("falls back to the free allowance for unknown plans", () => {
    expect(monthlyPointsFor("mystery")).toBe(50);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/agent/models.test.ts`
Expected: FAIL — `src/lib/agent/models.ts` belum ada.

- [ ] **Step 3: Implementasi `src/lib/agent/models.ts`**

```ts
export interface AgentModel {
  id: string;
  label: string;
  provider: string;
  points: number;
}

// Tarif poin proporsional dengan harga asli Sumopod (basis ~$0.001 biaya API per poin
// untuk balasan tipikal ±1.200 token input + ±150 token output).
export const AGENT_MODELS: AgentModel[] = [
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "OpenAI", points: 1 },
  { id: "gemini/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Gemini", points: 1 },
  { id: "MiniMax-M3", label: "MiniMax M3", provider: "MiniMax", points: 1 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic", points: 2 },
  { id: "gpt-5", label: "GPT-5", provider: "OpenAI", points: 3 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "Anthropic", points: 4 },
  { id: "gemini/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "Gemini", points: 4 },
  { id: "gpt-5.4", label: "GPT-5.4", provider: "OpenAI", points: 6 },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "Anthropic", points: 10 },
];

const MODELS_BY_ID = new Map(AGENT_MODELS.map((m) => [m.id, m]));

// Plafon poin per model yang boleh dipilih tiap paket.
export const PLAN_POINT_CEILING: Record<string, number> = {
  free: 2,
  pro: 4,
  business: Infinity,
};

// Jatah poin per bulan tiap paket. null = tak terbatas (dipertahankan untuk keamanan tipe).
export const PLAN_MONTHLY_POINTS: Record<string, number | null> = {
  free: 50,
  pro: 500,
  business: 1500,
};

// Default aman: 2 poin, diizinkan semua paket (plafon free = 2).
export const DEFAULT_MODEL = "claude-haiku-4-5";

export function pointCostFor(modelId: string): number {
  const model = MODELS_BY_ID.get(modelId);
  if (!model) {
    throw new Error(`Unknown agent model: ${modelId}`);
  }
  return model.points;
}

function ceilingFor(plan: string): number {
  return plan in PLAN_POINT_CEILING ? PLAN_POINT_CEILING[plan] : PLAN_POINT_CEILING.free;
}

export function isModelAllowedForPlan(plan: string, modelId: string): boolean {
  const model = MODELS_BY_ID.get(modelId);
  if (!model) {
    return false;
  }
  return model.points <= ceilingFor(plan);
}

export function modelsForPlan(plan: string): AgentModel[] {
  const ceiling = ceilingFor(plan);
  return AGENT_MODELS.filter((m) => m.points <= ceiling);
}

export function defaultModelForPlan(_plan: string): string {
  return DEFAULT_MODEL;
}

export function monthlyPointsFor(plan: string): number | null {
  return plan in PLAN_MONTHLY_POINTS ? PLAN_MONTHLY_POINTS[plan] : PLAN_MONTHLY_POINTS.free;
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/agent/models.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/models.ts tests/lib/agent/models.test.ts
git commit -m "Add agent model catalog, point costs, and plan access rules"
```

---

### Task 3: Akuntansi poin (ganti isi `limits.ts`)

**Files:**
- Modify: `src/lib/agent/limits.ts` (ganti seluruh isi)
- Modify: `tests/lib/agent/limits.test.ts` (ganti seluruh isi)

**Interfaces:**
- Consumes: `monthlyPointsFor` dari `src/lib/agent/models.ts` (Task 2); `prisma`.
- Produces: `pointsUsedThisMonth(profileId: string, now?: Date): Promise<number>`, `hasEnoughPoints(profileId: string, plan: string, modelCost: number, now?: Date): Promise<boolean>`. Dipakai Task 7 (webhook gate), Task 9 (status route).
- Menghapus: `monthlyLimitFor`, `hasExceededMonthlyLimit`, `AGENT_PLAN_LIMITS` (satu-satunya konsumen adalah webhook-handler, diubah di Task 7).

- [ ] **Step 1: Ganti test dengan yang berbasis poin**

Replace seluruh isi `tests/lib/agent/limits.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentMessage: { aggregate: vi.fn() },
  },
}));

import { hasEnoughPoints, pointsUsedThisMonth } from "@/lib/agent/limits";
import { prisma } from "@/lib/prisma";

function mockSum(points: number | null) {
  (prisma.agentMessage.aggregate as any).mockResolvedValue({ _sum: { points } });
}

describe("pointsUsedThisMonth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums message points since the start of the current month", async () => {
    mockSum(42);
    const now = new Date("2026-07-19T10:00:00Z");

    const result = await pointsUsedThisMonth("profile-1", now);

    expect(result).toBe(42);
    expect(prisma.agentMessage.aggregate).toHaveBeenCalledWith({
      _sum: { points: true },
      where: { profileId: "profile-1", createdAt: { gte: new Date(2026, 6, 1) } },
    });
  });

  it("returns 0 when there are no messages yet", async () => {
    mockSum(null);
    expect(await pointsUsedThisMonth("profile-1")).toBe(0);
  });
});

describe("hasEnoughPoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows a reply well within a large allowance (business)", async () => {
    mockSum(100); // business = 1500; 100 + 10 = 110 <= 1500
    expect(await hasEnoughPoints("profile-1", "business", 10)).toBe(true);
  });

  it("allows a reply that fits exactly within the allowance", async () => {
    mockSum(48); // free = 50; 48 + 2 = 50 <= 50
    expect(await hasEnoughPoints("profile-1", "free", 2)).toBe(true);
  });

  it("blocks a reply that would exceed the allowance", async () => {
    mockSum(49); // free = 50; 49 + 2 = 51 > 50
    expect(await hasEnoughPoints("profile-1", "free", 2)).toBe(false);
  });

  it("accounts for the model's point cost", async () => {
    mockSum(498); // pro = 500; 498 + 3 = 501 > 500
    expect(await hasEnoughPoints("profile-1", "pro", 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/agent/limits.test.ts`
Expected: FAIL — fungsi `pointsUsedThisMonth`/`hasEnoughPoints` belum ada.

- [ ] **Step 3: Ganti isi `src/lib/agent/limits.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { monthlyPointsFor } from "./models";

// Total poin yang sudah dipotong untuk profil ini sejak awal bulan kalender.
export async function pointsUsedThisMonth(
  profileId: string,
  now: Date = new Date()
): Promise<number> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await prisma.agentMessage.aggregate({
    _sum: { points: true },
    where: { profileId, createdAt: { gte: monthStart } },
  });
  return result._sum.points ?? 0;
}

// True bila memproses satu balasan seharga `modelCost` poin masih di dalam jatah bulanan.
export async function hasEnoughPoints(
  profileId: string,
  plan: string,
  modelCost: number,
  now: Date = new Date()
): Promise<boolean> {
  const allowance = monthlyPointsFor(plan);
  if (allowance === null) {
    return true;
  }
  const used = await pointsUsedThisMonth(profileId, now);
  return used + modelCost <= allowance;
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/agent/limits.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/limits.ts tests/lib/agent/limits.test.ts
git commit -m "Replace monthly message limit with point-based accounting"
```

---

### Task 4: `generateReply` menerima parameter model

**Files:**
- Modify: `src/lib/agent/claude-client.ts`
- Modify: `tests/lib/agent/claude-client.test.ts`

**Interfaces:**
- Produces: `generateReply(params: { systemPrompt: string; history: { role: "user" | "assistant"; content: string }[]; model?: string }): Promise<string>`. `model` opsional; fallback ke `process.env.AGENT_MODEL`. Dipakai Task 6.

- [ ] **Step 1: Tambah test bahwa model diteruskan**

Di `tests/lib/agent/claude-client.test.ts`, di dalam `describe("generateReply", ...)`, tambahkan test baru setelah test pertama:

```ts
  it("uses the model passed in params over the env default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await generateReply({
      systemPrompt: "s",
      history: [{ role: "user", content: "halo" }],
      model: "gpt-4o-mini",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).model).toBe("gpt-4o-mini");
  });
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/agent/claude-client.test.ts`
Expected: FAIL — model saat ini diambil dari konstanta modul, bukan params.

- [ ] **Step 3: Ubah `src/lib/agent/claude-client.ts`**

Ganti baris konstanta `MODEL` dan pemakaiannya. Isi file menjadi:

```ts
const BASE_URL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";
const DEFAULT_MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-6";

export async function generateReply(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  model?: string;
}): Promise<string> {
  const apiKey = process.env.SUMOPOD_API_KEY;
  const model = params.model || DEFAULT_MODEL;

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "system", content: params.systemPrompt }, ...params.history],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sumopod chat completion failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/agent/claude-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/claude-client.ts tests/lib/agent/claude-client.test.ts
git commit -m "Let generateReply accept a per-call model"
```

---

### Task 5: `logOutbound` mencatat poin

**Files:**
- Modify: `src/lib/agent/messages.ts`
- Modify: `tests/lib/agent/messages.test.ts`

**Interfaces:**
- Produces: `logOutbound(params: { profileId: string | null; phone: string; body: string; points?: number }): Promise<void>` — menulis `points` (default 0) ke `AgentMessage`. Dipakai Task 6.

- [ ] **Step 1: Sesuaikan & tambah test**

Di `tests/lib/agent/messages.test.ts`, ganti test dalam `describe("logOutbound", ...)` menjadi:

```ts
  it("creates an outbound message row with default 0 points", async () => {
    await logOutbound({ profileId: "profile-1", phone: "+15551234567", body: "reply" });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        phone: "+15551234567",
        direction: "out",
        body: "reply",
        points: 0,
      },
    });
  });

  it("records the points charged for an AI reply", async () => {
    await logOutbound({ profileId: "profile-1", phone: "+15551234567", body: "reply", points: 4 });

    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        phone: "+15551234567",
        direction: "out",
        body: "reply",
        points: 4,
      },
    });
  });
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/agent/messages.test.ts`
Expected: FAIL — `create` belum menyertakan `points`.

- [ ] **Step 3: Ubah `logOutbound` di `src/lib/agent/messages.ts`**

```ts
export async function logOutbound(params: {
  profileId: string | null;
  phone: string;
  body: string;
  points?: number;
}): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      profileId: params.profileId,
      phone: params.phone,
      direction: "out",
      body: params.body,
      points: params.points ?? 0,
    },
  });
}
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/agent/messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/messages.ts tests/lib/agent/messages.test.ts
git commit -m "Record points charged on outbound AI replies"
```

---

### Task 6: `process-job` pakai model tenant & potong poin

**Files:**
- Modify: `src/lib/agent/process-job.ts`
- Modify: `tests/lib/agent/process-job.test.ts`

**Interfaces:**
- Consumes: `pointCostFor`, `isModelAllowedForPlan`, `defaultModelForPlan` (Task 2); `generateReply` dengan `model` (Task 4); `logOutbound` dengan `points` (Task 5).
- Produces: perilaku — balasan dibuat dengan model tenant, poin dipotong pada balasan sukses.

- [ ] **Step 1: Sesuaikan test happy-path**

Di `tests/lib/agent/process-job.test.ts`:

(a) Tambahkan mock modul `models` setelah blok `vi.mock("@/lib/agent/claude-client", ...)`:

```ts
vi.mock("@/lib/agent/models", () => ({
  pointCostFor: vi.fn(() => 4),
  isModelAllowedForPlan: vi.fn(() => true),
  defaultModelForPlan: vi.fn(() => "claude-haiku-4-5"),
}));
```

(b) Tambahkan importnya di daftar import:

```ts
import { pointCostFor, isModelAllowedForPlan, defaultModelForPlan } from "@/lib/agent/models";
```

(c) Ganti fixture `profile` agar punya `plan` & `agentModel`:

```ts
const profile = {
  id: "profile-1",
  whatsappPhone: "+15551234567",
  businessName: "Toko A",
  timezone: "Asia/Jakarta",
  plan: "pro",
  agentModel: "claude-sonnet-5",
};
```

(d) Ganti isi test happy-path `it("sends the reply, logs it, and completes the job", ...)`:

```ts
  it("sends the reply, logs it with points, and completes the job", async () => {
    await processJob("job-1");

    expect(generateReply).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-5" })
    );
    expect(sendWhatsAppText).toHaveBeenCalledWith("+15551234567", "Halo juga!");
    expect(logOutbound).toHaveBeenCalledWith({
      profileId: "profile-1",
      phone: "+15551234567",
      body: "Halo juga!",
      points: 4,
    });
    expect(completeJob).toHaveBeenCalledWith("job-1");
    expect(failJob).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Jalankan test — pastikan gagal**

Run: `npx vitest run tests/lib/agent/process-job.test.ts`
Expected: FAIL — `generateReply` belum menerima `model`, `logOutbound` belum menyertakan `points`.

- [ ] **Step 3: Ubah `src/lib/agent/process-job.ts`**

Tambahkan import di atas:

```ts
import { pointCostFor, isModelAllowedForPlan, defaultModelForPlan } from "./models";
```

Di dalam `try`, ganti blok pembuatan balasan (dari `const systemPrompt = ...` sampai `await completeJob(jobId);`) menjadi:

```ts
    const systemPrompt = buildSystemPrompt({
      businessName: profile.businessName,
      timezone: profile.timezone,
      facts,
    });

    const model = isModelAllowedForPlan(profile.plan, profile.agentModel)
      ? profile.agentModel
      : defaultModelForPlan(profile.plan);

    const reply = await generateReply({
      systemPrompt,
      history: toClaudeHistory(history),
      model,
    });

    await sendWhatsAppText(profile.whatsappPhone, reply);
    await logOutbound({
      profileId: profile.id,
      phone: profile.whatsappPhone,
      body: reply,
      points: pointCostFor(model),
    });
    await completeJob(jobId);
```

- [ ] **Step 4: Jalankan test — pastikan lulus**

Run: `npx vitest run tests/lib/agent/process-job.test.ts`
Expected: PASS (ketiga blok describe hijau).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/process-job.ts tests/lib/agent/process-job.test.ts
git commit -m "Use tenant model and charge points in process-job"
```

---

### Task 7: Gate poin di webhook

**Files:**
- Modify: `src/lib/agent/webhook-handler.ts`

**Interfaces:**
- Consumes: `pointCostFor`, `isModelAllowedForPlan`, `defaultModelForPlan` (Task 2); `hasEnoughPoints` (Task 3).
- Catatan: `webhook-handler` diverifikasi manual (pola repo — tak ada unit test route/handler ini). Verifikasi lewat `tsc` + cek end-to-end Task 11 / QA manual.

- [ ] **Step 1: Ganti import limit**

Di `src/lib/agent/webhook-handler.ts`, ganti baris:

```ts
import { hasExceededMonthlyLimit } from "./limits";
```

menjadi:

```ts
import { hasEnoughPoints } from "./limits";
import { pointCostFor, isModelAllowedForPlan, defaultModelForPlan } from "./models";
```

- [ ] **Step 2: Ganti blok gate**

Ganti blok:

```ts
  if (await hasExceededMonthlyLimit(profile.id, profile.plan)) {
    await replyStatic(
      phone,
      profile.id,
      `Kuota pesan bulanan paket Anda sudah habis. Upgrade paket di ${baseUrl()}/agent untuk melanjutkan.`
    );
    return { status: 200 };
  }
```

menjadi:

```ts
  const model = isModelAllowedForPlan(profile.plan, profile.agentModel)
    ? profile.agentModel
    : defaultModelForPlan(profile.plan);
  if (!(await hasEnoughPoints(profile.id, profile.plan, pointCostFor(model)))) {
    await replyStatic(
      phone,
      profile.id,
      `Poin AI bulan ini sudah habis. Upgrade paket di ${baseUrl()}/agent atau tunggu awal bulan berikutnya.`
    );
    return { status: 200 };
  }
```

- [ ] **Step 3: Verifikasi type-check & seluruh test**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

Run: `npx vitest run tests/lib/agent`
Expected: seluruh test agent hijau.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/webhook-handler.ts
git commit -m "Gate agent replies on the tenant's monthly point budget"
```

---

### Task 8: Admin reset model saat paket berubah

**Files:**
- Modify: `src/lib/agent/admin.ts`

**Interfaces:**
- Consumes: `isModelAllowedForPlan`, `defaultModelForPlan` (Task 2).
- Catatan: perubahan kecil pada `activateAgentProfile`. Diverifikasi lewat `tsc` + Task 2 (helper sudah diuji) + QA manual di `/admin`.

- [ ] **Step 1: Tambah import**

Di `src/lib/agent/admin.ts`:

```ts
import { isModelAllowedForPlan, defaultModelForPlan } from "./models";
```

- [ ] **Step 2: Reset model bila tak diizinkan paket baru**

Ganti isi `activateAgentProfile` menjadi:

```ts
export async function activateAgentProfile(
  userEmail: string,
  plan?: AgentPlan
): Promise<AgentAdminResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const existing = await prisma.agentProfile.findUnique({ where: { userId: user.id } });
  const modelReset =
    plan && existing && !isModelAllowedForPlan(plan, existing.agentModel)
      ? { agentModel: defaultModelForPlan(plan) }
      : {};

  await prisma.agentProfile.upsert({
    where: { userId: user.id },
    update: { status: "active", ...(plan ? { plan } : {}), ...modelReset },
    create: { userId: user.id, status: "active", ...(plan ? { plan } : {}) },
  });

  return { ok: true };
}
```

- [ ] **Step 3: Verifikasi type-check**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/admin.ts
git commit -m "Reset tenant model to plan default when plan changes"
```

---

### Task 9: Route ganti model + status diperluas

**Files:**
- Create: `src/app/api/agent/model/route.ts`
- Modify: `src/app/api/agent/status/route.ts`

**Interfaces:**
- Consumes: `getOwnProfile` (existing), `isModelAllowedForPlan`, `modelsForPlan`, `monthlyPointsFor` (Task 2), `pointsUsedThisMonth` (Task 3), `prisma`, `authOptions`.
- Produces:
  - `POST /api/agent/model` `{ model }` → `{ ok, model }` / `{ ok:false, message }`.
  - `GET /api/agent/status` diperluas dengan `plan`, `agentModel`, `pointsUsed`, `pointsAllowance`, `pointsRemaining`, `availableModels`.
- Catatan: route diverifikasi manual (pola repo).

- [ ] **Step 1: Buat `src/app/api/agent/model/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnProfile } from "@/lib/agent/profile";
import { isModelAllowedForPlan } from "@/lib/agent/models";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const model: string | undefined = body?.model;
  if (!model) {
    return NextResponse.json({ ok: false, message: "Model belum dipilih." }, { status: 400 });
  }

  const profile = await getOwnProfile(session.user.id);
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { ok: false, message: "Akun agent Anda belum aktif." },
      { status: 403 }
    );
  }

  if (!isModelAllowedForPlan(profile.plan, model)) {
    return NextResponse.json(
      { ok: false, message: "Model ini tidak tersedia di paket Anda." },
      { status: 403 }
    );
  }

  await prisma.agentProfile.update({ where: { id: profile.id }, data: { agentModel: model } });
  return NextResponse.json({ ok: true, model });
}
```

- [ ] **Step 2: Perluas `src/app/api/agent/status/route.ts`**

Ganti seluruh isi:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnProfile } from "@/lib/agent/profile";
import { pointsUsedThisMonth } from "@/lib/agent/limits";
import { modelsForPlan, monthlyPointsFor } from "@/lib/agent/models";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const profile = await getOwnProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ ok: true, profile: null });
  }

  const pointsUsed = await pointsUsedThisMonth(profile.id);
  const pointsAllowance = monthlyPointsFor(profile.plan);

  return NextResponse.json({
    ok: true,
    profile: {
      whatsappPhone: profile.whatsappPhone,
      phoneVerifiedAt: profile.phoneVerifiedAt,
      status: profile.status,
      plan: profile.plan,
      agentModel: profile.agentModel,
      pointsUsed,
      pointsAllowance,
      pointsRemaining:
        pointsAllowance === null ? null : Math.max(0, pointsAllowance - pointsUsed),
      availableModels: modelsForPlan(profile.plan),
    },
  });
}
```

> `AgentLinkPanel` hanya membaca `profile.phoneVerifiedAt` — tetap ada, jadi tak ada regresi.

- [ ] **Step 3: Verifikasi type-check & test**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

Run: `npx vitest run tests/lib/agent`
Expected: hijau.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/agent/model/route.ts src/app/api/agent/status/route.ts
git commit -m "Add model-select route and point/model info in status"
```

---

### Task 10: Dashboard — meter poin & pemilih model

**Files:**
- Create: `src/components/agent/AgentModelPanel.tsx`
- Modify: `src/app/agent/dashboard/page.tsx`

**Interfaces:**
- Consumes: `GET /api/agent/status`, `POST /api/agent/model` (Task 9).
- Catatan: komponen client, diverifikasi manual di browser (Task 11).

- [ ] **Step 1: Buat `src/components/agent/AgentModelPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

interface ModelOption {
  id: string;
  label: string;
  provider: string;
  points: number;
}

interface UsageData {
  agentModel: string;
  pointsUsed: number;
  pointsAllowance: number | null;
  pointsRemaining: number | null;
  availableModels: ModelOption[];
}

export function AgentModelPanel() {
  const [data, setData] = useState<UsageData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.profile) {
          setData(d.profile as UsageData);
        }
      })
      .catch(() => {});
  }, []);

  async function handleChange(model: string) {
    setError("");
    setSaving(true);
    const res = await fetch("/api/agent/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    const d = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !d?.ok) {
      setError(d?.message || "Gagal mengganti model.");
      return;
    }
    setData((prev) => (prev ? { ...prev, agentModel: model } : prev));
  }

  if (!data) {
    return null;
  }

  return (
    <div className="mt-8 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <p className="font-medium text-ink">Model AI &amp; Poin</p>
      <p className="mt-1 text-sm text-muted">
        Poin terpakai bulan ini: {data.pointsUsed}
        {data.pointsAllowance === null ? "" : ` / ${data.pointsAllowance}`}
        {data.pointsRemaining === null ? "" : ` (sisa ${data.pointsRemaining})`}
      </p>

      <label htmlFor="agent-model" className="mt-4 block text-sm text-muted">
        Model aktif
      </label>
      <select
        id="agent-model"
        value={data.agentModel}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="mt-1 w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 focus:outline-none focus:ring-2 focus:ring-gold-400 disabled:opacity-50"
      >
        {data.availableModels.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} · {m.provider} · {m.points} poin/balasan
          </option>
        ))}
      </select>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Render di dashboard**

Di `src/app/agent/dashboard/page.tsx`, tambahkan import:

```ts
import { AgentModelPanel } from "@/components/agent/AgentModelPanel";
```

Lalu di dalam `<main>` blok aktif, tambahkan `<AgentModelPanel />` tepat setelah `<AgentLinkPanel ... />`:

```tsx
      <AgentLinkPanel
        displayNumber={process.env.WHATSAPP_DISPLAY_NUMBER ?? ""}
        whatsappPhone={profile.whatsappPhone}
        phoneVerifiedAt={profile.phoneVerifiedAt ? profile.phoneVerifiedAt.toISOString() : null}
      />
      <AgentModelPanel />
```

- [ ] **Step 3: Verifikasi type-check & build**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add src/components/agent/AgentModelPanel.tsx src/app/agent/dashboard/page.tsx
git commit -m "Add points meter and model selector to agent dashboard"
```

---

### Task 11: Verifikasi penuh & cek end-to-end

**Files:** none (verifikasi saja).

- [ ] **Step 1: Seluruh suite unit test**

Run: `npm test`
Expected: seluruh test lulus (termasuk `models`, `limits`, `messages`, `process-job`, `claude-client` yang baru/diubah). Bila ada kegagalan di berkas non-agent yang sudah ada sebelum plan ini (mis. `orders.test.ts`), catat sebagai pre-existing dan di luar ruang lingkup.

- [ ] **Step 2: Build produksi**

Run: `npm run build`
Expected: build sukses tanpa error tipe.

- [ ] **Step 3: Cek manual dashboard**

Run: `npm run dev`. Login sebagai user dengan `AgentProfile.status = "active"`.
- Buka `/agent/dashboard` → panel "Model AI & Poin" tampil, meter poin terbaca (mis. `0 / 500`), dropdown hanya berisi model yang diizinkan paket.
- Ganti model → tersimpan (reload tetap terpilih). Coba (via devtools) POST model di luar paket → `403`.

- [ ] **Step 4: Cek manual alur WhatsApp (bila lingkungan Meta + Sumopod siap)**

- Kirim pesan dari nomor owner aktif → balasan datang; kolom `points` pada baris balasan terisi sesuai model.
- Habiskan jatah (atau set jatah kecil sementara) → balasan berikutnya diblok dengan pesan "Poin AI bulan ini sudah habis".

---

## Phase complete when

- `npm test` hijau untuk seluruh `tests/lib/agent/*` (termasuk `models.test.ts` baru).
- `npm run build` sukses.
- Tenant dapat memilih model yang diizinkan paketnya dari `/agent/dashboard`, dan pilihan tersimpan.
- Balasan AI memotong poin sesuai model; saat jatah bulanan habis, balasan diblok dengan pesan poin habis dan Claude/model tidak dipanggil.
- Admin mengubah paket tenant → model tenant yang tak lagi diizinkan otomatis direset ke default.
