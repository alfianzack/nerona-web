# Server-Side Prompts + Structured Generate Endpoint — Design

**Date:** 2026-07-24
**Status:** Approved (user: move prompts to nerona-web; batch up to 50 images)

## Summary

Move the extension's AI **prompt construction** into nerona-web so the shipped extension no
longer contains the prompt IP. A new structured endpoint `POST /api/extension/generate`
takes `{ feature, marketplace, …context, image }`, **assembles the prompt server-side
(ported verbatim from the extension)**, calls the AI (admin key, metered), and returns the
**raw model text** (`content`). The extension keeps its response **parsing + per-marketplace
normalization** (user chose "prompt only"). Batches of **up to 50 images** run **3 at a
time**, metering per image; when points run out mid-batch, remaining images are **skipped
and summarized**. This also lets us retire the raw-`messages` `/api/extension/ai` (the client
can no longer inject prompts → more secure).

**Hard rule:** prompts are moved **byte-for-byte unchanged** ([[nerona-metadata-prompts-do-not-change]]). The server-assembled prompt must equal the string the extension used to build for the same inputs.

## nerona-web

### `src/lib/extension/prompts.ts` (new) — verbatim port
Port these constants + assembly, copied EXACTLY from `content.js`:
- `METADATA_GENERATOR_PROMPT_QUICK`, `METADATA_GENERATOR_PROMPT_ADVANCED`, `getMetadataGeneratorPrompt(mode)`, `getMetadataAiCaps(mode)`.
- `AI_SCORING_AGENT_PROMPT` + `SCORING_AI_CAPS`; `COMMERCIAL_INTENT_ANALYZER_PROMPT` + `COMMERCIAL_INTENT_AI_CAPS`; `MICROSTOCK_EVENT_KEYWORD_RESEARCH_PROMPT` + `KEYWORD_AI_CAPS`; the Reject-Analyzer prompt (from `generateRejectAnalysisFromImage`).
- The per-marketplace hint strings (Vecteezy title hint, Miricanvas keyword hint) and the batch-index hint.
Assembly functions returning `{ prompt: string, maxTokens: number }` (mirroring the exact concatenations found in content.js):
- `buildMetadataPrompt({ marketplace, promptMode, batchIndex })` →
  `` `${getMetadataGeneratorPrompt(mode)}\nContext marketplace: ${marketplace}.${vecteezyHint}${miricanvasHint}${batchIndexHint}`.trim() ``, caps from `getMetadataAiCaps(mode)`.
- `buildScoringPrompt({ marketplace })` → `` `${AI_SCORING_AGENT_PROMPT}\n\nContext: analyzing for contributor upload on ${marketplace}.\nReturn JSON only.` ``, `SCORING_AI_CAPS`.
- `buildCommercialIntentPrompt({ marketplace })` → the exact commercial-intent concatenation, `COMMERCIAL_INTENT_AI_CAPS`.
- `buildKeywordPrompt({ marketplace, monthsCurrent, monthsNext, referenceDate })` → the exact keyword concatenation (date + current/next month labels + marketplace), `KEYWORD_AI_CAPS`. `referenceDate` defaults to today (server) if omitted.
- `buildRejectPrompt({ marketplace, contextSnippet })` → the exact reject concatenation, its caps.
`AI_CAPS` here supply `maxTokens` (the OpenAI max-output cap) per feature/mode.

### `POST /api/extension/generate` (new)
Token-guarded metered endpoint (same gate order as `/api/extension/ai`): resolve token →
rate-limit → `active` → points>0 → validate body → assemble prompt → AI → meter → return.
- Body: `{ feature: "metadata"|"scoring"|"commercial_intent"|"keyword"|"reject", marketplace: string, promptMode?, batchIndex?, monthsCurrent?, monthsNext?, contextSnippet?, image?: { mime: string, dataBase64: string } }`.
- Validate `feature` is one of the five; validate the image (present + `data:` size ≤ ~12MB) for all features except `keyword` (text-only); reject unknown feature → 400.
- Assemble `{ prompt, maxTokens }` via the matching `build*Prompt(...)`. Build `messages`:
  image features → `[{ role:"user", content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:`data:${mime};base64,${dataBase64}`}}] }]`; `keyword` → `[{ role:"user", content: prompt }]`.
- `getAiSettings()` (admin model+key; 503 if no key) → `chatCompletion({ messages, model, apiKey, maxTokens })` (502 on throw, no spend) → `costForUsage` → `spendPoints` → `{ ok:true, content, usage, pointsBalance }`.
- The client CANNOT send a prompt or model — only structured inputs; the server owns all prompt text. (This is why it supersedes the raw-`messages` endpoint.)

### Rate limit
Raise the AI rate limit so a 50-image batch at concurrency 3 isn't throttled: `hit(\`extgen:${userId}\`, 90, 60_000)` (90/min). (Still per-user; abuse bounded by points.) Applies to the new endpoint.

### Retire `/api/extension/ai`
Once the extension uses `/api/extension/generate`, the raw-`messages` `/api/extension/ai`
has no client. Remove it (and its test) — or keep temporarily; spec chooses **remove** for
security (no client-supplied prompts). `chatCompletion` stays (used by the new endpoint).

## Extension (`nerona_medata`)

- **`NeronaWebClient`**: replace `generate(messages)` with `generateFeature(payload)` →
  `POST {base}/api/extension/generate` with the Bearer token + the structured `payload`;
  return `{ ok, content, usage, pointsBalance }` / `{ ok:false, error }` (same fail-closed
  mapping incl. 402/403/401/429/413).
- **`content.js`**: at each of the 5 sites, STOP building the prompt; instead call
  `NeronaWebClient.generateFeature({ feature, marketplace, …context, image })` where `image`
  = the `imageElementToInlineData` result `{ mime, dataBase64 }` (rename fields as needed).
  Keep the existing parse/normalization of the returned `content` UNCHANGED. Then DELETE the
  moved prompt constants + `get*Prompt`/`get*AiCaps` + hint strings + `*_AI_CAPS` from
  content.js (they now live server-side). `callAiForMetadata`/`callAiTextOnly` are replaced
  by the per-feature `generateFeature` calls (or become thin wrappers that call it).
- **Batch runner (up to 50, concurrency 3):** the selected-assets generate loop runs a
  **concurrency pool of 3**. Per image: call `generateFeature`; on success fill the form; on
  `no_points` mark that image failed and DON'T start new ones once points are exhausted; on
  other errors mark failed and continue. At the end show a summary: "X dari N berhasil, Y
  gagal (poin habis / error)". (If the existing queue is sequential, add the pool.)
- **Image encoding** (`imageElementToInlineData`) stays client-side (grab image → base64).

## Data flow (per image)
```
content.js (image → base64) → NeronaWebClient.generateFeature({feature,marketplace,ctx,image})
  → POST /api/extension/generate  [gate: token→rate(90/min)→active→points→validate]
     → build*Prompt() [ported verbatim] → messages → chatCompletion(admin key) → cost→spendPoints
  ← { content, usage, pointsBalance }
← parse + normalize content (unchanged) → fill form
Batch: pool of 3; skip remaining + summarize when points run out.
```

## Error handling
- Endpoint: 401/429/403/402/400/413/503/502 as with `/api/extension/ai`; unknown feature → 400.
- Extension per-image: map errors → Indonesian; `no_points` stops launching new tasks; batch summary at end.

## Testing / verification
- **Prompt-parity (critical):** `prompts.ts` unit tests assert each `build*Prompt(...)` output
  equals the exact expected string for representative inputs (metadata quick/advanced ×
  vecteezy/miricanvas/other × with/without batchIndex; scoring; commercial; keyword;
  reject) — snapshot the expected strings copied from the current extension so any drift
  fails. This is how we prove "prompt unchanged."
- **Endpoint** (`/api/extension/generate`): 401/429/403/402/400(unknown feature)/413/200;
  200 asserts `chatCompletion` called with the assembled prompt + the image message, then
  `spendPoints`; 502 → no spend. Mock deps.
- **Extension** (no harness): `node --check`; committed-blob check for cherry-staged content.js;
  grep confirms moved prompt constants are GONE from content.js and 0 dangling refs; manual
  smoke: batch of a few images (and >3 to exercise the pool), confirm fills + points drop +
  poin-habis summary.

## Not doing
- Moving parsing/normalization server-side (user chose prompt-only; those stay in extension).
- Moving marketplace DOM selectors to server config.
- Changing any prompt wording — verbatim port only.
- Binary/multipart image upload (keep base64-in-JSON; batch is per-image so payloads stay small).
