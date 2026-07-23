# Admin AI Connection Settings — Design

**Date:** 2026-07-23
**Status:** Approved (proceeding to plan per user)

## Summary

Let the owner admin set the Sumopod **AI model** and **API key** from the admin
settings UI (`/admin/pengaturan`) instead of only via server env vars. Values are
stored in the existing `Setting` key/value table and read at call time by the WhatsApp
agent's `generateReply`. Env vars remain the fallback, so existing deployments keep
working with nothing configured.

This is a follow-up to the points-wallet feature: the agent's per-call point cost is
metered from the model's price, so the model in use must be known at runtime.

## Terminology

- **AI settings** — the Sumopod connection config: the model id and the API key.
- Base URL stays an env var (`SUMOPOD_BASE_URL`); it is not admin-editable (out of scope).

## Data model

No schema change. Reuse the `Setting` model (key/value), two new keys:
- `ai_model` — Sumopod model id (free text; empty ⇒ fall back to env/default).
- `ai_api_key` — Sumopod API key (empty ⇒ fall back to env).

## Backend

### `src/lib/ai-settings.ts` (mirrors `src/lib/payment-settings.ts`)

```ts
export interface AiSettings { model: string; apiKey: string; }

// Reads the two Setting rows; falls back to env when a value is blank.
// model: setting `ai_model` || process.env.AGENT_MODEL || "gemini-2.0-flash-lite"
// apiKey: setting `ai_api_key` || process.env.SUMOPOD_API_KEY || ""
getAiSettings(): Promise<AiSettings>

// Upserts. `model` is always written (trimmed; blank stored as "" ⇒ env fallback).
// `apiKey` is written ONLY when a non-empty trimmed value is passed, so re-saving
// without retyping the key leaves the stored key intact.
updateAiSettings(values: { model: string; apiKey?: string }): Promise<void>

// For display: never returns the raw key.
// { model, apiKeyMasked, apiKeySet } — apiKeyMasked = "****" + last4 (or "****"
// for short keys), "" when unset; apiKeySet = whether a key is stored OR in env.
getAiSettingsView(): Promise<{ model: string; apiKeyMasked: string; apiKeySet: boolean }>
```

The masked value is derived only from the stored/env key; the raw key never leaves the
server. The key is never written to logs.

### `src/lib/agent/claude-client.ts`

`generateReply` currently reads `MODEL` from env at module load and `apiKey` from env
inside the function. Change it to resolve both from `getAiSettings()` at call time:

```ts
const { model, apiKey } = await getAiSettings();
// ...use `model` in the request body and Authorization: `Bearer ${apiKey}`
return { text, model, usage };   // `model` is the configured model (used for pricing)
```

`BASE_URL` stays env-derived. The returned `GenerateReplyResult` shape is unchanged;
`model` now reflects the configured value so `costForUsage` prices the right model.

### `GET/POST /api/admin/ai-settings`

Admin-guarded exactly like `src/app/api/admin/payment-settings/route.ts`
(`getServerSession(authOptions)` → 401 when `!session?.user?.role`).
- **GET** → `{ ok: true, settings: { model, apiKeyMasked, apiKeySet } }` (from `getAiSettingsView`).
- **POST** body `{ model, apiKey }` → `updateAiSettings({ model, apiKey })`; a blank/absent
  `apiKey` leaves the stored key unchanged. Returns `{ ok: true }`.

## UI

`src/components/admin/AdminAiSettingsPanel.tsx`, added to the `/admin/pengaturan` page
alongside the existing bank-settings panel. Mirrors `AdminBankSettingsPanel`'s
structure/classes:
- Loads GET on mount.
- **Model** — text input (placeholder shows the default, e.g. `gemini-2.0-flash-lite`).
- **API key** — password-type input; when a key is set the field is empty with a
  placeholder like `"Tersimpan (****abcd) — biarkan kosong untuk tetap"`; typing a new
  value replaces it.
- Save posts to the route; shows a saved/failed message. Indonesian copy throughout.

## Data flow

1. Admin opens `/admin/pengaturan` → panel GETs `{ model, apiKeyMasked, apiKeySet }`.
2. Admin edits model and/or enters a new key → POST → upsert.
3. Next agent job → `generateReply` calls `getAiSettings()` → uses the configured model
   + key against Sumopod; the point cost is metered from that model.

## Error handling

- Non-admin → 401 on both route methods.
- Invalid/non-object POST body → 400 (Indonesian message).
- No AI settings and no env fallback (blank key) → `generateReply` hits Sumopod with an
  empty bearer token and the request fails; the job's existing failure/apology path
  handles it (no new behavior). The panel surfaces `apiKeySet: false` so the admin sees
  it's unconfigured.

## Testing

- Unit `src/lib/ai-settings.ts`: `getAiSettings` returns stored values; falls back to env
  when a row is blank/absent; `updateAiSettings` upserts model, and does NOT overwrite the
  key when `apiKey` is blank/absent but DOES when non-empty; `getAiSettingsView` masks the
  key (`****`+last4), never returns raw, and reports `apiKeySet` correctly.
- Route `/api/admin/ai-settings`: GET/POST reject non-admin (401); GET returns the masked
  view (never the raw key); POST with a blank key preserves the stored key.
- `claude-client.test.ts`: update to mock `@/lib/ai-settings` `getAiSettings` and assert
  the request uses the resolved model + `Bearer <apiKey>`, and the returned `model` equals
  the configured model.

## Not doing (YAGNI)

- Encrypting the API key at rest (stored plaintext like the existing bank settings; masked
  in UI, never logged).
- Making `SUMOPOD_BASE_URL` admin-editable.
- A model dropdown / catalog, or admin-entered per-model USD rates (model is free text;
  unknown models meter at the price-table fallback rate — a known limitation).
- Per-tenant model/key (this is a single global connection).
- Live "test connection" button.
