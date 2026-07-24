# Extension AI Proxy (metered) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the extension's metadata AI calls through a metered nerona-web endpoint (admin key, points-deducted) instead of the user's own API key; remove the popup's AI-credential inputs.

**Architecture:** A thin proxy: the extension keeps building the OpenAI-style `messages` (prompt + inline image) and parsing the result; nerona-web's `POST /api/extension/ai` forwards to Sumopod with the admin key/model, gates on token+license+points+rate, and deducts points via the wallet.

**Tech Stack:** nerona-web = Next.js 14 + Prisma + Vitest; reuses `extension-auth`, `extension-sync`, `ai-settings`, `pricing`, `points`, `rate-limit`. Extension = plain MV3 JS (manual verification).

## Global Constraints

- Proxy is token-guarded (`Authorization: Bearer <ExtensionToken>`). Order: resolve token (401) → rate-limit per user (429) → `active` (403 `inactive`) → `pointsBalance > 0` (402 `no_points`) → validate body (400) → `getAiSettings` (503 `ai_not_configured`) → `chatCompletion` (502 `ai_error` on throw) → meter+spend → 200.
- Client body is ONLY `{ messages }` (array, non-empty, ≤ 40 items). Server forces `model` (from `getAiSettings`) + `maxTokens: 1024`; the client cannot override model/key/tokens. The admin key is never returned to the client.
- Rate limit: `hit(\`extai:${userId}\`, 30, 60_000)` from `src/lib/rate-limit.ts`.
- Points deducted only after a successful completion (`costForUsage({ model, usage })` → `spendPoints`); a failed AI call is not charged. Spend is best-effort (a spend error is logged, response still returns).
- All extension user-facing copy Indonesian. Import alias `@/` → `src/`. nerona-web tests mock deps.
- Commit on master with EXPLICIT paths; NEVER `git add -A`. `core.autocrlf=true` prints harmless CRLF warnings.
- Extension is a SEPARATE repo (`nerona_medata`, branch main) with unrelated uncommitted changes — commit explicit paths only; no test harness → `node --check` + manual.

---

### Task 1: `chatCompletion` helper

**Files:**
- Modify: `src/lib/agent/claude-client.ts`
- Test: `tests/lib/chat-completion.test.ts`

**Interfaces:**
- Produces: `ChatCompletionResult = { text: string; model: string; usage: { promptTokens: number; completionTokens: number } | null }`; `chatCompletion({ messages, model, apiKey, maxTokens? }): Promise<ChatCompletionResult>`.

- [ ] **Step 1: Write the failing test** — `tests/lib/chat-completion.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion } from "@/lib/agent/claude-client";

afterEach(() => vi.unstubAllGlobals());

describe("chatCompletion", () => {
  it("POSTs messages + model + bearer and returns text/usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "hasil metadata" } }],
        usage: { prompt_tokens: 1200, completion_tokens: 150 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const msgs = [{ role: "user", content: [{ type: "text", text: "hi" }] }];
    const res = await chatCompletion({ messages: msgs, model: "gemini-2.0-flash", apiKey: "k1", maxTokens: 512 });

    expect(res.text).toBe("hasil metadata");
    expect(res.model).toBe("gemini-2.0-flash");
    expect(res.usage).toEqual({ promptTokens: 1200, completionTokens: 150 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer k1");
    const body = JSON.parse(init.body);
    expect(body).toEqual(expect.objectContaining({ model: "gemini-2.0-flash", max_tokens: 512, messages: msgs }));
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }));
    await expect(
      chatCompletion({ messages: [{ role: "user", content: "x" }], model: "m", apiKey: "k" })
    ).rejects.toThrow(/500/);
  });

  it("returns null usage when absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }) }));
    const res = await chatCompletion({ messages: [{ role: "user", content: "x" }], model: "m", apiKey: "k" });
    expect(res.text).toBe("");
    expect(res.usage).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify RED** — `npm test -- tests/lib/chat-completion.test.ts` → FAIL (chatCompletion not exported).

- [ ] **Step 3: Add `chatCompletion` to `src/lib/agent/claude-client.ts`** (append; reuse the existing `BASE_URL` constant)

```ts
export interface ChatCompletionResult {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
}

export async function chatCompletion(params: {
  messages: Array<{ role: string; content: unknown }>;
  model: string;
  apiKey: string;
  maxTokens?: number;
}): Promise<ChatCompletionResult> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      messages: params.messages,
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
  return { text, model: params.model, usage };
}
```
(Leave `generateReply` unchanged — the proxy is the consumer.)

- [ ] **Step 4: Run to verify GREEN** — `npm test -- tests/lib/chat-completion.test.ts` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/claude-client.ts tests/lib/chat-completion.test.ts
git commit -m "feat: chatCompletion helper (raw messages -> Sumopod)"
```

---

### Task 2: `POST /api/extension/ai`

**Files:**
- Create: `src/app/api/extension/ai/route.ts`
- Test: `tests/lib/extension-ai-route.test.ts`

**Interfaces:**
- Consumes: `resolveExtensionToken` (`@/lib/extension-auth`), `getExtensionAccountState` (`@/lib/extension-sync`), `getAiSettings` (`@/lib/ai-settings`), `chatCompletion` (`@/lib/agent/claude-client`), `costForUsage` (`@/lib/agent/pricing`), `spendPoints` (`@/lib/points`), `hit` (`@/lib/rate-limit`).

- [ ] **Step 1: Write the failing test** — `tests/lib/extension-ai-route.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
vi.mock("@/lib/agent/claude-client", () => ({ chatCompletion: vi.fn() }));
vi.mock("@/lib/agent/pricing", () => ({ costForUsage: vi.fn(() => 5) }));
vi.mock("@/lib/points", () => ({ spendPoints: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ hit: vi.fn(() => ({ ok: true, remaining: 29, retryAfterSeconds: 0 })) }));

import { POST } from "@/app/api/extension/ai/route";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";
import { chatCompletion } from "@/lib/agent/claude-client";
import { spendPoints } from "@/lib/points";
import { hit } from "@/lib/rate-limit";

function req(body: unknown, auth = "Bearer nrx_ok") {
  return new Request("http://test/api/extension/ai", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : {},
    body: JSON.stringify(body),
  });
}
const okMessages = [{ role: "user", content: "hi" }];

beforeEach(() => {
  vi.clearAllMocks();
  (resolveExtensionToken as any).mockResolvedValue({ userId: "u1" });
  (hit as any).mockReturnValue({ ok: true, remaining: 29, retryAfterSeconds: 0 });
  (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 100 });
  (getAiSettings as any).mockResolvedValue({ model: "gemini-2.0-flash", apiKey: "adminkey" });
  (chatCompletion as any).mockResolvedValue({ text: "meta", model: "gemini-2.0-flash", usage: { promptTokens: 1200, completionTokens: 150 } });
  (spendPoints as any).mockResolvedValue(95);
});

describe("POST /api/extension/ai", () => {
  it("401 without/with invalid token", async () => {
    (resolveExtensionToken as any).mockResolvedValue(null);
    expect((await POST(req(okMessages, ""))).status).toBe(401);
    expect((await POST(req(okMessages))).status).toBe(401);
  });
  it("429 when rate-limited", async () => {
    (hit as any).mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 30 });
    expect((await POST(req({ messages: okMessages }))).status).toBe(429);
  });
  it("403 when license inactive", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: false, pointsBalance: 100 });
    expect((await POST(req({ messages: okMessages }))).status).toBe(403);
  });
  it("402 when no points", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 0 });
    expect((await POST(req({ messages: okMessages }))).status).toBe(402);
  });
  it("400 on a bad body", async () => {
    expect((await POST(req({ messages: [] }))).status).toBe(400);
    expect((await POST(req({ messages: "nope" }))).status).toBe(400);
  });
  it("200 happy path: calls chatCompletion + spendPoints, returns content/usage/balance", async () => {
    const res = await POST(req({ messages: okMessages }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, content: "meta", usage: { promptTokens: 1200, completionTokens: 150 }, pointsBalance: 95 });
    expect(chatCompletion).toHaveBeenCalledWith(expect.objectContaining({ messages: okMessages, model: "gemini-2.0-flash", apiKey: "adminkey" }));
    expect(spendPoints).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", cost: 5 }));
  });
  it("502 and no spend when the AI call throws", async () => {
    (chatCompletion as any).mockRejectedValue(new Error("upstream"));
    const res = await POST(req({ messages: okMessages }));
    expect(res.status).toBe(502);
    expect(spendPoints).not.toHaveBeenCalled();
  });
  it("503 when the admin key is not configured", async () => {
    (getAiSettings as any).mockResolvedValue({ model: "m", apiKey: "" });
    expect((await POST(req({ messages: okMessages }))).status).toBe(503);
  });
});
```

- [ ] **Step 2: Run to verify RED** — `npm test -- tests/lib/extension-ai-route.test.ts` → FAIL (module missing).

- [ ] **Step 3: Create `src/app/api/extension/ai/route.ts`**

```ts
import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";
import { chatCompletion } from "@/lib/agent/claude-client";
import { costForUsage } from "@/lib/agent/pricing";
import { spendPoints } from "@/lib/points";
import { hit } from "@/lib/rate-limit";

export const maxDuration = 60;

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rl = hit(`extai:${resolved.userId}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const state = await getExtensionAccountState(resolved.userId);
  if (!state.active) {
    return NextResponse.json({ ok: false, error: "inactive" }, { status: 403 });
  }
  if (state.pointsBalance <= 0) {
    return NextResponse.json({ ok: false, error: "no_points" }, { status: 402 });
  }

  const body = await request.json().catch(() => null);
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const { model, apiKey } = await getAiSettings();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ai_not_configured" }, { status: 503 });
  }

  let result;
  try {
    result = await chatCompletion({ messages, model, apiKey, maxTokens: 1024 });
  } catch (err) {
    console.error("[extension/ai] upstream error", err);
    return NextResponse.json({ ok: false, error: "ai_error" }, { status: 502 });
  }

  const cost = costForUsage({ model: result.model, usage: result.usage });
  let pointsBalance = state.pointsBalance;
  try {
    pointsBalance = await spendPoints({ userId: resolved.userId, cost, note: "Metadata generation" });
  } catch (err) {
    console.error("[extension/ai] spend failed", err);
  }

  return NextResponse.json({ ok: true, content: result.text, usage: result.usage, pointsBalance });
}
```

- [ ] **Step 4: Run to verify GREEN** — `npm test -- tests/lib/extension-ai-route.test.ts` → PASS (8). Then `npm test` once (2 pre-existing unrelated `orders.test.ts` failures only).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/extension/ai/route.ts tests/lib/extension-ai-route.test.ts
git commit -m "feat: metered extension AI proxy endpoint"
```

---

### Task 3: Extension — route generation through the proxy (repo `nerona_medata`)

**Files (in `nerona_medata`):**
- Modify: `content.js` (metadata generation call site), `access/nerona-web-client.js` (add a `generate(messages)` helper)

- [ ] **Step 1: Add a `generate` helper to `access/nerona-web-client.js`**

Add to the module (and to the `globalThis.NeronaWebClient` export) a function that posts messages to the proxy with the stored token:
```js
async function generate(messages) {
  const t = await getToken();
  if (!t) return { ok: false, error: "missing_license" };
  const base = baseUrl();
  if (!base) return { ok: false, error: "server_not_configured" };
  let res;
  try {
    res = await fetch(`${base}/api/extension/ai`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch (_e) {
    return { ok: false, error: "network" };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || (res.status === 402 ? "no_points" : res.status === 403 ? "inactive" : "ai_error"), status: res.status };
  }
  return { ok: true, content: data.content, usage: data.usage, pointsBalance: data.pointsBalance };
}
```
Export it: `globalThis.NeronaWebClient = { getToken, setToken, fetchAccountState, generate };`

- [ ] **Step 2: Re-point the generation call in `content.js`**

READ `content.js` around the provider dispatch (the `callProviderVision`-style function near the `provider` switch, ~lines 4820-4890, and the OpenAI-compatible `messages` builder near ~4700-4720). Change the generation path so that instead of calling the provider directly with `settings.apiKey`, it:
1. Builds the same OpenAI-style `messages` array it already builds for `callOpenAiCompatibleVision` (system/user text + `{ type: "image_url", image_url: { url: dataUrl } }`).
2. Calls `const r = await NeronaWebClient.generate(messages);`.
3. On `r.ok`, use `r.content` exactly where the provider's returned text was used (same downstream parsing).
4. On `!r.ok`, throw an Error with an Indonesian message mapped from `r.error` (`no_points` → "Poin habis. Isi ulang di dashboard Nerona.", `inactive` → "Paket tidak aktif.", `missing_license` → "Hubungkan akun Nerona dulu (token).", `network`/`ai_error` → "Gagal generate via Nerona. Coba lagi.").

Keep this the ONLY generation path (the direct-provider functions may remain as dead code). Do not touch unrelated content.js logic.

- [ ] **Step 3: Syntax check** — `node --check content.js` and `node --check access/nerona-web-client.js`.

- [ ] **Step 4: Manual verification**

With nerona-web running, a valid token connected, and points > 0: trigger generate on a supported marketplace page → confirm (Network tab) the request goes to `/api/extension/ai` (NOT to a provider), metadata fills from `content`, and the popup balance drops. With 0 points → generation stops with the "Poin habis" message.

- [ ] **Step 5: Commit (in `nerona_medata`)**

```bash
cd ../nerona_medata
git add content.js access/nerona-web-client.js
git commit -m "feat: generate metadata via nerona-web proxy (metered)"
```

---

### Task 4: Extension — remove AI-credential inputs from the popup (repo `nerona_medata`)

**Files (in `nerona_medata`):**
- Modify: `popup.html` (remove the AI Settings section), `popup.js` (remove the provider/model/apiKey/baseUrl logic)

- [ ] **Step 1: Remove the AI Settings block in `popup.html`**

READ `popup.html`. Remove the "AI Settings" `<details>` block (the `provider`/`modelPreset`/`model`/`apiKey`/`baseUrl` fields, the Nerona-models section, and the "Test Koneksi AI" button). Replace with a short note:
```html
      <details class="settings" open>
        <summary>AI</summary>
        <p class="hint">Model &amp; AI dikelola oleh Nerona. Setiap generate memakai poin akun Anda.</p>
      </details>
```

- [ ] **Step 2: Remove the dead logic in `popup.js`**

READ `popup.js`. Remove the element refs + handlers tied to the removed ids (`provider`, `modelPreset`, `model`, `apiKey`, `baseUrl`, the Nerona-models list/budget, `getSettings`/`resolveEffectiveModel`/provider-preset code, and the Sumopod-gate keys logic). Update or delete any code that referenced them so nothing dangles (search for every removed id). Keep the "Akun Nerona" token UI (Task 7 of sub-project 2) and the account status intact. `content.js` no longer reads these settings (Task 3), so removing the popup persistence is safe.

If a piece of removed logic is deeply entangled and risky to excise, it is acceptable to instead HIDE the section (`hidden` attribute) and stop reading its values — but prefer removal. Note in the report whichever you did.

- [ ] **Step 3: Syntax check** — `node --check popup.js`; confirm `popup.html` well-formed and no removed id is still referenced (`grep`).

- [ ] **Step 4: Manual verification**

Reload the extension: the popup shows only "Akun Nerona" (token + status) and the short AI note — no provider/model/API-key fields. Generation still works (via the proxy) and no console errors about missing elements.

- [ ] **Step 5: Commit (in `nerona_medata`)**

```bash
cd ../nerona_medata
git add popup.html popup.js
git commit -m "feat: remove manual AI credential inputs (AI managed by Nerona)"
```

---

## Self-Review Notes

- **Spec coverage:** `chatCompletion` helper (Task 1); metered proxy endpoint with token/rate/active/points/body gates + spend (Task 2); extension generation routed through the proxy (Task 3); popup AI-credential inputs removed (Task 4). Testing maps to Tasks 1–2 (vitest); Tasks 3–4 `node --check` + manual (no extension harness).
- **Deferred (per spec):** server-side prompt/parse, per-user model choice, streaming, dead-code cleanup, reconciling the Sumopod-gate budget code.
- **Security:** admin key server-only (`getAiSettings`), never returned; endpoint token-authed + active + points + rate-limited; server forces model/maxTokens; client body limited to `messages`.
- **Type/shape consistency:** `chatCompletion` (Task 1) consumed by Task 2; `getExtensionAccountState` (`active`, `pointsBalance`), `costForUsage`, `spendPoints`, `hit` signatures match their existing definitions; the proxy's `{ content, usage, pointsBalance }` response is consumed by the extension client's `generate` (Task 3).
- **Two repos:** Tasks 1–2 commit in `nerona-web`; Tasks 3–4 in `nerona_medata` (branch main), explicit paths only.
