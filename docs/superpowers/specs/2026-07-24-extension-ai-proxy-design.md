# Extension AI Proxy (metered, server-side key) — Design

**Date:** 2026-07-24
**Status:** Approved (go straight to spec + implementation per user)

## Summary

Sub-project 3 (final) of [[nerona-metadata-web-sync-direction]]. Metadata generation in the
`nerona_medata` extension stops calling AI providers directly with the user's own API key,
and instead **proxies the AI call through nerona-web**, which uses the admin Sumopod
key/model, gates on license + points, deducts points per call, and returns the completion.
The extension keeps its existing prompt-building + response-parsing (a **thin metered
proxy**, not a server-side pipeline). The popup's provider/model/API-key inputs are removed.

Chosen for speed (least rework, extension logic unchanged) and security (the admin key
never reaches the browser; the endpoint is token-authed, license/points-gated, rate-limited,
and forces the server-side model so it can't be abused as a free AI relay). Model + key
come from the admin **AI settings** ([[nerona-points-wallet-feature]] `ai-settings`) — which
must be a vision-capable model.

## nerona-web

### `chatCompletion` helper — `src/lib/agent/claude-client.ts` (extend)
Generalize the existing Sumopod call into a reusable function the proxy and (optionally
later) the agent share:
```ts
export interface ChatCompletionResult { text: string; model: string; usage: { promptTokens: number; completionTokens: number } | null }
export async function chatCompletion(params: {
  messages: Array<{ role: string; content: unknown }>;  // OpenAI-compatible, may include image_url parts
  model: string;
  apiKey: string;
  maxTokens?: number;
}): Promise<ChatCompletionResult>
```
POSTs to `${SUMOPOD_BASE_URL}/chat/completions` with `{ model, max_tokens, messages }` and
`Authorization: Bearer <apiKey>`; returns `{ text, model, usage }` (usage from
`data.usage`). `generateReply` is refactored to build its messages then call
`chatCompletion` (behavior unchanged) — or left as-is if cleaner; the proxy is the primary
consumer.

### `POST /api/extension/ai` (new)
Token-guarded (`Authorization: Bearer <ExtensionToken>`), the metered proxy:
1. `resolveExtensionToken` → `userId`; 401 if missing/invalid.
2. `getExtensionAccountState(userId)`: if `!active` → 403 `{ ok:false, error:"inactive" }`;
   if `pointsBalance <= 0` → 402 `{ ok:false, error:"no_points" }`.
3. **Rate limit** per userId using `src/lib/rate-limit.ts` (e.g. 30 requests / minute) →
   429 `{ ok:false, error:"rate_limited" }` when exceeded.
4. Validate body `{ messages }`: must be a non-empty array within a sane cap (≤ ~40 items);
   reject otherwise with 400. **The client cannot set model/key/maxTokens** — those come
   from the server.
5. Resolve `{ model, apiKey } = await getAiSettings()`; if no `apiKey` → 503
   `{ ok:false, error:"ai_not_configured" }`.
6. `chatCompletion({ messages, model, apiKey, maxTokens: 1024 })`.
7. Meter: `cost = costForUsage({ model, usage })`; `newBalance = await spendPoints({ userId, cost, note: "Metadata generation" })`.
8. Return `{ ok:true, content, usage, pointsBalance: newBalance }`.
- Spend happens after a successful completion (a failed AI call is not charged). Gate is
  before the call (balance must be > 0 to start). Body size: rely on Next's default; the
  route sets a reasonable `maxDuration`.
- Errors from Sumopod (non-ok) → 502 `{ ok:false, error:"ai_error" }` (no points charged).

### Security properties (explicit)
- Admin Sumopod key is read server-side (`getAiSettings`) and **never sent to the client**.
- Endpoint requires a valid ExtensionToken **and** an active license **and** points > 0.
- Server forces `model` + `maxTokens`; the client body is limited to `messages`, so the
  endpoint can't be repurposed as an unmetered general AI relay.
- Rate-limited per user; every call costs points (abuse is self-limiting + bounded).

## Extension (`nerona_medata`)

- **`content.js`:** replace the direct provider calls
  (`callGeminiVision`/`callOpenAiCompatibleVision`/`callClaudeVision`) used during metadata
  generation with a single call to nerona-web: `POST {neronaWebBaseUrl}/api/extension/ai`
  with the Bearer token and the OpenAI-style `messages` array the extension already builds
  (system/user text + `image_url` inline data). Parse `data.content` exactly as the current
  code parses the model's text output. On `no_points`/`inactive`/`ai_error`, surface a clear
  Indonesian message and stop (fail closed). Points balance in the response can update the
  popup's shown balance.
- **Remove the user's AI credential inputs:** delete the provider/model/API-key/base-URL
  fields from `popup.html` (the "AI Settings" section) and the related `popup.js` logic;
  replace with a short note "Model & AI dikelola oleh Nerona (poin)". Keep the "Test
  Koneksi AI" only if it now hits the nerona-web proxy (optional; otherwise remove).
- The provider-specific vision builders may remain in `content.js` as dead code for now
  (full removal is cleanup), but the generation path must go through the proxy.
- `neronaWebBaseUrl` + token already exist from sub-project 2; reused here.

## Data flow

1. User triggers generate on a marketplace page → `content.js` builds the `messages`
   (prompt + inline image) as today.
2. `content.js` → `POST /api/extension/ai` (Bearer token, `{ messages }`).
3. nerona-web gates (token/active/points/rate) → calls Sumopod with the admin key/model →
   deducts points → returns `{ content, usage, pointsBalance }`.
4. `content.js` parses `content` and fills the form; popup balance reflects the new total.

## Error handling

- 401 invalid token; 403 inactive license; 402 no points; 429 rate-limited; 400 bad body;
  503 AI not configured; 502 AI upstream error. Each maps to an Indonesian message in the
  extension; all are fail-closed (no metadata filled).
- Points are deducted only on a successful completion.

## Testing

- `chatCompletion` (vitest, stub fetch): posts messages + model + bearer, returns
  `{ text, model, usage }`; throws on non-ok.
- `POST /api/extension/ai`: 401 (no token), 403 (inactive), 402 (no points), 429
  (rate-limited), 200 happy path calls `chatCompletion` then `spendPoints` and returns
  `{ content, usage, pointsBalance }`; a Sumopod error → 502 and NO spend. Mock
  `resolveExtensionToken`/`getExtensionAccountState`/`getAiSettings`/`chatCompletion`/
  `spendPoints`/rate-limit.
- Extension side: no harness → `node --check` + manual (generate on a real page with a
  valid token + points; confirm the request goes to `/api/extension/ai`, metadata fills,
  and the balance drops).

## Not doing (YAGNI / later)

- Server-side prompt-building / marketplace parsing (thin proxy only).
- Per-user model choice (server uses the admin AI-settings model).
- Streaming responses (single JSON response).
- Removing the extension's dead provider code / Sumopod-gate budget code (cleanup later;
  the popup's `nrx_` token no longer feeds a provider key).
- Storing generated metadata server-side.
