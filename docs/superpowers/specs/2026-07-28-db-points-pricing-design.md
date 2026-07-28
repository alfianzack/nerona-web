# Admin-Editable Points Pricing — Design

**Date:** 2026-07-28
**Status:** Approved (user asked to implement directly)

## Summary

Move the point-metering rates out of code and env and into the admin AI settings, so
the owner can retune what an AI call costs without a redeploy.

Today `costForUsage` (`src/lib/agent/pricing.ts`) prices a call from a hardcoded
`MODEL_PRICES` map keyed by model id, times `POINTS_PER_USD` read from env. Two
problems:

1. The owner can already set **any** model at `/admin/pengaturan`, but a model missing
   from the map silently falls back to the cheapest row and under-charges.
2. The map is keyed on the model id the API *returns* (`gemini-2.0-flash-001`), which
   need not match the id the owner typed (`gemini-2.0-flash`) — so the lookup can miss
   even for a model that IS in the map.

Since exactly one model is active at a time, the fix is to attach the two USD rates to
that one AI setting instead of maintaining a table. Nothing keys off a model id
anymore, so neither miss is possible.

Follow-up to [admin AI connection settings](2026-07-23-admin-ai-connection-settings-design.md)
and the [points wallet](2026-07-23-tenant-points-finance-tab-design.md).

## Scope

In: three admin-editable rates, a pure `costForUsage`, the admin panel fields, docs,
tests.

Out (deliberate): per-tenant or per-feature rates, a markup multiplier separate from
`points_per_usd`, an audit log of rate changes, recomputing past ledger entries.

## Data model

No schema change. Three new keys in the existing `Setting` (key/value) table:

| key | meaning | env fallback | code default |
|---|---|---|---|
| `ai_price_in` | USD per 1,000,000 input tokens | `AI_PRICE_IN` | `0.075` |
| `ai_price_out` | USD per 1,000,000 output tokens | `AI_PRICE_OUT` | `0.30` |
| `points_per_usd` | poin per 1 USD | `POINTS_PER_USD` | `100000` |

The code defaults are today's `gemini-2.0-flash-lite` rates and today's
`POINTS_PER_USD` default, so a deployment that configures nothing bills exactly as it
does now.

## Backend

### `src/lib/ai-settings.ts`

The three keys are read in the **same `findMany`** as `ai_model`/`ai_api_key`, so an AI
call costs no extra database round-trip.

```ts
export interface AiPricing {
  inPerMTok: number;    // USD per 1M input tokens
  outPerMTok: number;   // USD per 1M output tokens
  pointsPerUsd: number;
}

export interface AiSettings {
  model: string;
  apiKey: string;
  pricing: AiPricing;
}
```

Resolution per field: DB value → env → code default. A value is **treated as unset**
(falls through to the next source) when it is blank, non-numeric, not finite, or
negative. `pointsPerUsd` must additionally be `> 0`.

`0` is a valid rate and means a free model; a call still costs the `max(1, …)` floor,
so an AI call is never free.

`updateAiSettings` gains the three optional fields. A field explicitly set to `""`
writes `""`, which clears it back to the fallback chain. A field not passed is left
untouched (same rule the API key already uses).

`getAiSettingsView` returns, for each of the three, the **raw** stored value (`""` when
unset) plus the **effective** resolved value, so the panel can show the real number in
force as a placeholder.

### `src/lib/agent/pricing.ts`

`MODEL_PRICES`, `DEFAULT_PRICE` and the `pointsPerUsd()` env reader are deleted, along
with the unknown-model warning they existed for. The module becomes pure — no env, no
map, no I/O — and is therefore importable from a client component:

```ts
export function costForUsage(params: { usage: TokenUsage | null; pricing: AiPricing }): number
```

The maths is unchanged:

```
usd  = promptTokens/1e6 × pricing.inPerMTok + completionTokens/1e6 × pricing.outPerMTok
cost = max(1, ceil(usd × pricing.pointsPerUsd))
```

Missing or all-zero usage keeps today's conservative fallback: price a ~1,000-token
reply at the configured output rate. The `model` parameter is dropped.

### Call sites

Both already hold the resolved settings, so neither needs a new fetch:

- `src/lib/agent/claude-client.ts` — `generateReply` already calls `getAiSettings()`;
  it now returns `pricing` alongside `{ text, model, usage }`.
- `src/lib/agent/turn.ts` — passes `result.pricing` into `costForUsage`. The ledger
  note is unchanged, so it keeps recording the model string and old entries stay
  comparable with new ones.
- `src/app/api/extension/generate/route.ts` — destructures `pricing` from its existing
  `getAiSettings()` call.

`chatCompletion` is untouched: it takes an explicit model/key and does no metering.

## Admin UI

`src/components/admin/AdminAiSettingsPanel.tsx` gains three numeric inputs below the
existing model and API-key fields:

```
/admin/pengaturan → Koneksi AI

  Model            [ gemini-2.0-flash-lite   ]
  API Key          [ ****a91f                ]
  Harga input      [ 0.075   ] USD / 1jt token
  Harga output     [ 0.30    ] USD / 1jt token
  Poin per USD     [ 100000  ]

  Estimasi: 1.500 token in + 400 token out ≈ 23 poin

  [ Simpan ]
```

An empty field means "pakai default"; the effective value is shown as the input's
placeholder so the owner can always see what is actually in force.

The estimate line is computed in the browser by importing the same pure
`costForUsage`, so the preview can never disagree with what is charged. It recomputes
as the fields change, using the typed values (falling back to the effective ones for
blank fields).

### `src/app/api/admin/ai-settings/route.ts`

`GET` additionally returns the three raw values and the three effective values.

`POST` accepts `priceIn`, `priceOut`, `pointsPerUsd` as strings. A blank string clears
the key. A value that is non-numeric, not finite, or negative (or, for
`pointsPerUsd`, zero) is rejected with `400` and an Indonesian message — it is never
silently stored or silently ignored. Auth is unchanged (any admin role, house
convention).

## Error handling

Nothing here can stop billing or serving: a bad or missing row degrades to env, then to
today's constants. A rate change applies to the **next** call only — the ledger is
append-only and past charges are never recomputed.

No cache or TTL: the settings read already happens on every AI call, and caching would
make an owner's edit take minutes to take effect for no measurable gain.

## Testing

- `tests/lib/agent/pricing.test.ts` — rewritten for the pure signature: normal usage,
  the `max(1, …)` floor, zero rates, null usage, missing-usage fallback priced at the
  configured out-rate.
- `tests/lib/ai-settings.test.ts` — the DB → env → default chain for each of the three
  keys, plus every invalid form (blank, non-numeric, negative, `pointsPerUsd` zero)
  falling through rather than poisoning the price.
- `tests/lib/ai-settings-route.test.ts` — `GET` exposes raw + effective; `POST`
  validation rejects bad values and a blank string clears a key.
- `tests/lib/extension-generate-route.test.ts` — the points charged follow the
  configured rates.
- Agent turn test — same assertion on the WhatsApp/web path.

## Docs

`docs/production.md`, `docs/vercel.md` and `docs/DEPLOY-VPS.md` currently document
`POINTS_PER_USD` as an env var. They are updated to describe it (and the two new
`AI_PRICE_*` vars) as the **fallback** for values now set at `/admin/pengaturan`.
