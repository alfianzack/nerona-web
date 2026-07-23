# Admin AI Connection Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner admin set the Sumopod AI model and API key from `/admin/pengaturan`, stored in the `Setting` table and used by the agent at call time, with env vars as fallback.

**Architecture:** Mirror the existing bank/payment-settings pattern: a typed `Setting`-backed service (`lib/ai-settings.ts`), a thin admin-guarded route, and a client panel on the settings page. `generateReply` resolves model + key from the service instead of env.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Prisma 5 (`Setting` key/value model) + Vitest.

## Global Constraints

- Admin routes guard exactly like `src/app/api/admin/payment-settings/route.ts`: `getServerSession(authOptions)` → `if (!session?.user?.role)` return `{ ok: false }` 401.
- `Setting` keys: `ai_model` and `ai_api_key`. No schema change.
- Env fallback: model → `process.env.AGENT_MODEL || "gemini-2.0-flash-lite"`; key → `process.env.SUMOPOD_API_KEY || ""`. `SUMOPOD_BASE_URL` stays env-only (not admin-editable).
- The raw API key is NEVER returned to the browser and NEVER logged. Display masked as `"****"+last4` (or `"****"` for length ≤ 4), `""` when unset.
- `updateAiSettings` writes the key ONLY when a non-empty trimmed value is passed (blank ⇒ keep the stored key).
- All user-facing copy is Indonesian.
- Import alias `@/` → `src/`. Tests in `tests/**/*.test.ts`, mock `@/lib/prisma`.
- Commit on master with EXPLICIT file paths; NEVER `git add -A`. `core.autocrlf=true` prints harmless CRLF warnings.

---

### Task 1: `src/lib/ai-settings.ts`

**Files:**
- Create: `src/lib/ai-settings.ts`
- Test: `tests/lib/ai-settings.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces:
  - `AiSettings = { model: string; apiKey: string }`
  - `getAiSettings(): Promise<AiSettings>` — effective values (stored, else env/default).
  - `updateAiSettings(values: { model: string; apiKey?: string }): Promise<void>`
  - `getAiSettingsView(): Promise<{ model: string; apiKeyMasked: string; apiKeySet: boolean }>` — raw stored model (may be ""), masked effective key, whether a key exists (stored or env).

- [ ] **Step 1: Write the failing test** — `tests/lib/ai-settings.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getAiSettings, updateAiSettings, getAiSettingsView } from "@/lib/ai-settings";
import { prisma } from "@/lib/prisma";

const OLD_ENV = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("getAiSettings", () => {
  it("returns stored model and key", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: "ai_model", value: "gpt-5" },
      { key: "ai_api_key", value: "sk-live-1234" },
    ]);
    expect(await getAiSettings()).toEqual({ model: "gpt-5", apiKey: "sk-live-1234" });
  });

  it("falls back to env/default when rows are blank/absent", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);
    delete process.env.AGENT_MODEL;
    process.env.SUMOPOD_API_KEY = "env-key";
    expect(await getAiSettings()).toEqual({ model: "gemini-2.0-flash-lite", apiKey: "env-key" });
  });
});

describe("updateAiSettings", () => {
  it("upserts the model and the key when the key is non-empty", async () => {
    await updateAiSettings({ model: "gpt-5", apiKey: "sk-new" });
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
  });

  it("does NOT write the key when it is blank/absent", async () => {
    await updateAiSettings({ model: "gpt-5" });
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(1);
    const call = (prisma.setting.upsert as any).mock.calls[0][0];
    expect(call.where.key).toBe("ai_model");
  });
});

describe("getAiSettingsView", () => {
  it("masks the key, never returns raw, and reports apiKeySet", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: "ai_model", value: "gpt-5" },
      { key: "ai_api_key", value: "sk-live-abcd" },
    ]);
    const view = await getAiSettingsView();
    expect(view).toEqual({ model: "gpt-5", apiKeyMasked: "****abcd", apiKeySet: true });
    expect(JSON.stringify(view)).not.toContain("sk-live-abcd");
  });

  it("reports apiKeySet false and empty mask when no key stored and no env", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);
    delete process.env.SUMOPOD_API_KEY;
    const view = await getAiSettingsView();
    expect(view.apiKeySet).toBe(false);
    expect(view.apiKeyMasked).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/ai-settings.test.ts`
Expected: FAIL — cannot find module `@/lib/ai-settings`.

- [ ] **Step 3: Create `src/lib/ai-settings.ts`**

```ts
import { prisma } from "@/lib/prisma";

export interface AiSettings {
  model: string;
  apiKey: string;
}

const KEY_MODEL = "ai_model";
const KEY_API = "ai_api_key";

function defaultModel(): string {
  return process.env.AGENT_MODEL || "gemini-2.0-flash-lite";
}

async function readRows(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [KEY_MODEL, KEY_API] } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getAiSettings(): Promise<AiSettings> {
  const map = await readRows();
  const model = (map.get(KEY_MODEL) || "").trim() || defaultModel();
  const apiKey = (map.get(KEY_API) || "").trim() || process.env.SUMOPOD_API_KEY || "";
  return { model, apiKey };
}

export async function updateAiSettings(values: { model: string; apiKey?: string }): Promise<void> {
  const modelValue = (values.model ?? "").trim();
  const ops = [
    prisma.setting.upsert({
      where: { key: KEY_MODEL },
      create: { key: KEY_MODEL, value: modelValue },
      update: { value: modelValue },
    }),
  ];
  const apiKey = (values.apiKey ?? "").trim();
  if (apiKey) {
    ops.push(
      prisma.setting.upsert({
        where: { key: KEY_API },
        create: { key: KEY_API, value: apiKey },
        update: { value: apiKey },
      })
    );
  }
  await prisma.$transaction(ops);
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

export async function getAiSettingsView(): Promise<{
  model: string;
  apiKeyMasked: string;
  apiKeySet: boolean;
}> {
  const map = await readRows();
  const model = (map.get(KEY_MODEL) || "").trim(); // raw; "" when unset
  const effectiveKey = (map.get(KEY_API) || "").trim() || process.env.SUMOPOD_API_KEY || "";
  return { model, apiKeyMasked: maskKey(effectiveKey), apiKeySet: Boolean(effectiveKey) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/ai-settings.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-settings.ts tests/lib/ai-settings.test.ts
git commit -m "feat: ai-settings service (Setting-backed model + api key, env fallback)"
```

---

### Task 2: `generateReply` resolves model + key from `getAiSettings`

**Files:**
- Modify: `src/lib/agent/claude-client.ts`
- Test: `tests/lib/agent/claude-client.test.ts` (update)

**Interfaces:**
- Consumes: `getAiSettings` from `@/lib/ai-settings`.
- Produces: `generateReply` unchanged signature and `GenerateReplyResult` shape; `model` in the result is now the configured model.

- [ ] **Step 1: Update the test** — `tests/lib/agent/claude-client.test.ts`

Add a mock for the settings module (near the top, before importing generateReply):

```ts
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
import { getAiSettings } from "@/lib/ai-settings";
```

Replace the `beforeEach` that sets `process.env.SUMOPOD_API_KEY` with:

```ts
  beforeEach(() => {
    (getAiSettings as any).mockResolvedValue({ model: "gemini-2.0-flash-lite", apiKey: "test-key" });
  });
```

(Remove the `afterEach` restore of `SUMOPOD_API_KEY`/`vi.unstubAllGlobals()` only for the env key; keep `vi.unstubAllGlobals()` for fetch.)

In the first test, after parsing `init.body`, also assert the model and the returned model:

```ts
    expect(JSON.parse(init.body)).toEqual(
      expect.objectContaining({
        model: "gemini-2.0-flash-lite",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "halo" },
        ],
      })
    );
    expect(result.model).toBe("gemini-2.0-flash-lite");
```

(`init.headers.Authorization === "Bearer test-key"` still holds because the mock returns `apiKey: "test-key"`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/agent/claude-client.test.ts`
Expected: FAIL — `getAiSettings` not used yet (the code still reads env; the mock has no effect, and `result.model` may differ / body model differs), or the module import of getAiSettings is unused.

- [ ] **Step 3: Update `src/lib/agent/claude-client.ts`**

Remove the module-level `MODEL` constant and resolve model + key inside the function. Full file:

```ts
import { getAiSettings } from "@/lib/ai-settings";

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
  const { model, apiKey } = await getAiSettings();

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
  const text = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      }
    : null;
  return { text, model, usage };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent/claude-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/claude-client.ts tests/lib/agent/claude-client.test.ts
git commit -m "feat: generateReply resolves model + key from ai-settings"
```

---

### Task 3: `GET/POST /api/admin/ai-settings`

**Files:**
- Create: `src/app/api/admin/ai-settings/route.ts`
- Test: `tests/lib/ai-settings-route.test.ts`

**Interfaces:**
- Consumes: `getAiSettingsView`, `updateAiSettings` from `@/lib/ai-settings`.
- Produces: `GET` → `{ ok: true, settings: { model, apiKeyMasked, apiKeySet } }`; `POST { model, apiKey }` → `{ ok: true }`.

- [ ] **Step 1: Write the failing test** — `tests/lib/ai-settings-route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/ai-settings", () => ({ getAiSettingsView: vi.fn(), updateAiSettings: vi.fn() }));

import { GET, POST } from "@/app/api/admin/ai-settings/route";
import { getServerSession } from "next-auth";
import { getAiSettingsView, updateAiSettings } from "@/lib/ai-settings";

function postReq(body: unknown) {
  return new Request("http://test/api/admin/ai-settings", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/ai-settings", () => {
  it("401 for non-admin", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns the masked view for an admin", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (getAiSettingsView as any).mockResolvedValue({ model: "gpt-5", apiKeyMasked: "****abcd", apiKeySet: true });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toEqual({ model: "gpt-5", apiKeyMasked: "****abcd", apiKeySet: true });
    expect(JSON.stringify(body)).not.toContain("sk-");
  });
});

describe("POST /api/admin/ai-settings", () => {
  it("401 for non-admin", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(postReq({ model: "gpt-5" }))).status).toBe(401);
  });

  it("400 on a non-object body", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const req = new Request("http://test/api/admin/ai-settings", { method: "POST", body: "not json" });
    expect((await POST(req)).status).toBe(400);
  });

  it("updates settings; a blank apiKey is passed through as undefined-ish (not written)", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const res = await POST(postReq({ model: "gpt-5", apiKey: "" }));
    expect(res.status).toBe(200);
    const call = (updateAiSettings as any).mock.calls[0][0];
    expect(call.model).toBe("gpt-5");
    expect(call.apiKey === "" || call.apiKey === undefined).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/ai-settings-route.test.ts`
Expected: FAIL — cannot find module `@/app/api/admin/ai-settings/route`.

- [ ] **Step 3: Create `src/app/api/admin/ai-settings/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiSettingsView, updateAiSettings } from "@/lib/ai-settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const settings = await getAiSettingsView();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
  await updateAiSettings({ model, apiKey });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/ai-settings-route.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/ai-settings/route.ts tests/lib/ai-settings-route.test.ts
git commit -m "feat: admin ai-settings GET/POST route"
```

---

### Task 4: `AdminAiSettingsPanel` on the settings page

**Files:**
- Create: `src/components/admin/AdminAiSettingsPanel.tsx`
- Modify: `src/app/admin/pengaturan/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/admin/ai-settings`.

- [ ] **Step 1: Create `src/components/admin/AdminAiSettingsPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

const inputClass =
  "w-full rounded-xl bg-surface px-3 py-2 text-sm text-ink ring-1 ring-navy-900/[.12] placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

export function AdminAiSettingsPanel() {
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/ai-settings");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat pengaturan AI.");
      return;
    }
    setModel(data.settings.model ?? "");
    setApiKeyMasked(data.settings.apiKeyMasked ?? "");
    setApiKeySet(Boolean(data.settings.apiKeySet));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    const res = await fetch("/api/admin/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, apiKey }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Gagal menyimpan pengaturan AI.");
      return;
    }
    setSaved(true);
    setApiKey("");
    load();
  }

  const keyPlaceholder = apiKeySet
    ? `Tersimpan (${apiKeyMasked}) — biarkan kosong untuk tetap`
    : "Tempel API key Sumopod";

  return (
    <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-sky/25 text-[#1F7FAE]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
          >
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">Koneksi AI (Sumopod)</h2>
          <p className="text-xs text-muted">Model & API key untuk balasan agen WhatsApp</p>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="ai-model" className="text-xs font-semibold text-ink">
            Model
          </label>
          <input
            id="ai-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gemini-2.0-flash-lite"
            className={`mt-1.5 ${inputClass}`}
          />
          <p className="mt-1 text-[11px] text-muted/80">
            Id model persis seperti di Sumopod. Kosongkan untuk pakai default.
          </p>
        </div>
        <div>
          <label htmlFor="ai-key" className="text-xs font-semibold text-ink">
            API key
          </label>
          <input
            id="ai-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyPlaceholder}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan koneksi AI"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">✓ Tersimpan</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `src/app/admin/pengaturan/page.tsx`**

```tsx
import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";
import { AdminBankSettingsPanel } from "@/components/admin/AdminBankSettingsPanel";
import { AdminAiSettingsPanel } from "@/components/admin/AdminAiSettingsPanel";

export default function AdminSettingsPage() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <AdminBankSettingsPanel />
      <AdminPricingPanel />
      <AdminAiSettingsPanel />
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds, no type errors. The settings page now shows a "Koneksi AI (Sumopod)" panel with Model + API key fields.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, sign in as admin, open `/admin/pengaturan`. Enter a model + key, Save → "✓ Tersimpan"; reload shows the key field empty with a `Tersimpan (****xxxx)` placeholder and the model persisted.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminAiSettingsPanel.tsx src/app/admin/pengaturan/page.tsx
git commit -m "feat: admin AI connection settings panel"
```

---

## Self-Review Notes

- **Spec coverage:** `ai-settings.ts` service with env fallback + masking (Task 1); `generateReply` reads settings (Task 2); admin route with masked GET + guarded POST (Task 3); settings panel wired into `/admin/pengaturan` (Task 4). Testing section of the spec maps to Tasks 1–3.
- **Deferred (per spec "Not doing"):** key encryption, editable base URL, model dropdown/rates, per-tenant config, test-connection button.
- **Type consistency:** `getAiSettings`/`updateAiSettings`/`getAiSettingsView` signatures defined in Task 1 are consumed unchanged in Tasks 2–3; `GenerateReplyResult` unchanged from the prior feature.
- **Security:** raw key never returned (route uses `getAiSettingsView`), never logged; masked in UI; only overwritten on non-empty submit.
