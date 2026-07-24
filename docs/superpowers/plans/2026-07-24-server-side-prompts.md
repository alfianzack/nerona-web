# Server-Side Prompts + Structured Generate Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the extension's AI prompt construction to nerona-web behind a structured `POST /api/extension/generate` endpoint (prompts copied verbatim), keep parsing/normalization in the extension, support batches of up to 50 images at concurrency 3 with points metering and graceful skip-on-no-points, and retire the raw-`messages` proxy.

**Architecture:** Extension sends `{ feature, marketplace, …context, image }` per image; server assembles the exact prompt (ported), calls the AI (admin key, metered), returns raw `content`; extension parses/normalizes and fills the form. A concurrency-3 pool drives the batch.

**Tech Stack:** nerona-web = Next.js 14 + Prisma + Vitest (reuses `extension-auth`, `extension-sync`, `ai-settings`, `pricing`, `points`, `rate-limit`, `chatCompletion`). Extension = plain MV3 JS (manual verify).

## Global Constraints

- **Prompts are copied BYTE-FOR-BYTE from the extension — never reworded** ([[nerona-metadata-prompts-do-not-change]]). Parity tests must prove the server-assembled string equals the extension's for the same inputs.
- Endpoint gate order (same as the retired `/api/extension/ai`): resolve token (401) → `hit(\`extgen:${userId}\`, 90, 60_000)` (429) → `active` (403) → points>0 (402) → validate body (400) → image ≤ ~12MB for non-`keyword` (413) → `getAiSettings` (503) → `chatCompletion` (502, no spend) → `costForUsage`+`spendPoints` → 200 `{ ok, content, usage, pointsBalance }`. Server owns prompt/model/maxTokens; client sends only structured inputs.
- Features: `metadata` | `scoring` | `commercial_intent` | `keyword` | `reject`. `keyword` is text-only (no image); the rest require an image.
- Extension keeps parsing/normalization UNCHANGED; only prompt-building moves. Batch: ≤50, pool of 3, skip-remaining + summary when points run out.
- Extension repo `nerona_medata` (branch main) has UNRELATED dirty files (content.js, marketplaces/*, QA_CHECKLIST.md) — commit ONLY task files by explicit path; cherry-stage `content.js` (git apply --cached) + verify committed blob `node --check`. NEVER `git add -A`. nerona-web tests mock deps.

---

### Task 1: Port prompts to `src/lib/extension/prompts.ts` (nerona-web)

**Files:** Create `src/lib/extension/prompts.ts`; Test `tests/lib/extension-prompts.test.ts`.

**Interfaces:** Produces `buildMetadataPrompt`, `buildScoringPrompt`, `buildCommercialIntentPrompt`, `buildKeywordPrompt`, `buildRejectPrompt`, each `(input) => { prompt: string; maxTokens: number }`.

- [ ] **Step 1: Copy the exact source strings** — open `nerona_medata/content.js` and copy VERBATIM (no edits) into `prompts.ts`: `METADATA_GENERATOR_PROMPT_QUICK` (~line 4825), `METADATA_GENERATOR_PROMPT_ADVANCED` (~4840), `getMetadataAiCaps` (~4865), `AI_SCORING_AGENT_PROMPT` (~5593) + `SCORING_AI_CAPS` (~5881), `COMMERCIAL_INTENT_ANALYZER_PROMPT` (~5887) + `COMMERCIAL_INTENT_AI_CAPS` (~5926), `MICROSTOCK_EVENT_KEYWORD_RESEARCH_PROMPT` (~5932) + `KEYWORD_AI_CAPS` (~6024), the Reject prompt string from `generateRejectAnalysisFromImage` (~7851), and the per-marketplace hint strings + batch-index hint from `generateMetadataFromImage` (~4890-4912). Preserve exact whitespace/newlines/punctuation.

- [ ] **Step 2: Write the parity test** — `tests/lib/extension-prompts.test.ts`. For each builder, assert the output `prompt` EQUALS the exact expected string (paste the same verbatim strings + the exact concatenation the extension used) and `maxTokens` matches the ported caps. Cover: metadata quick+advanced × {vecteezy, miricanvas, other} × {batchIndex present/absent}; scoring; commercial_intent; keyword (with monthsCurrent/monthsNext/referenceDate); reject (with contextSnippet). Example shape:
```ts
import { describe, expect, it } from "vitest";
import { buildScoringPrompt, buildMetadataPrompt } from "@/lib/extension/prompts";

describe("buildScoringPrompt", () => {
  it("matches the extension's exact scoring prompt", () => {
    const { prompt } = buildScoringPrompt({ marketplace: "Adobe Stock" });
    expect(prompt).toBe(
      `${AI_SCORING_AGENT_PROMPT}\n\nContext: analyzing for contributor upload on Adobe Stock.\nReturn JSON only.`
    );
  });
});
// (AI_SCORING_AGENT_PROMPT etc. = the verbatim constants, defined in the test too.)
```

- [ ] **Step 3: Run RED** — `npm test -- tests/lib/extension-prompts.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement `src/lib/extension/prompts.ts`** — the constants (verbatim) + builders reproducing the EXACT concatenations found in content.js:
  - `buildMetadataPrompt({ marketplace, promptMode, batchIndex })`: `mode = promptMode==="quick"?"quick":"advanced"`; base = quick/advanced; `vecteezyHint`/`miricanvasHint` (the exact hint strings, applied when `/vecteezy/i`/`/miricanvas/i` matches marketplace); `batchIndexHint` (exact string, when `Number.isFinite(batchIndex) && batchIndex>=0`); `prompt = \`${base}\nContext marketplace: ${marketplace}.${vecteezyHint}${miricanvasHint}${batchIndexHint}\`.trim()`; `maxTokens` from `getMetadataAiCaps(mode)`.
  - `buildScoringPrompt({ marketplace })` / `buildCommercialIntentPrompt({ marketplace })`: exact concatenations; caps from SCORING/COMMERCIAL caps.
  - `buildKeywordPrompt({ marketplace, monthsCurrent, monthsNext, referenceDate })`: `referenceDate = referenceDate || new Date().toISOString().slice(0,10)`; exact keyword concatenation; KEYWORD caps.
  - `buildRejectPrompt({ marketplace, contextSnippet })`: exact reject concatenation; its caps.
  Each returns `{ prompt, maxTokens }`.

- [ ] **Step 5: Run GREEN** — `npm test -- tests/lib/extension-prompts.test.ts` → PASS; `npm test` once (2 pre-existing `orders.test.ts` failures only).

- [ ] **Step 6: Commit** — `git add src/lib/extension/prompts.ts tests/lib/extension-prompts.test.ts` → `feat: server-side prompt builders (verbatim port from extension)`.

---

### Task 2: `POST /api/extension/generate` (nerona-web)

**Files:** Create `src/app/api/extension/generate/route.ts`; Test `tests/lib/extension-generate-route.test.ts`.

**Interfaces:** Consumes `resolveExtensionToken`, `getExtensionAccountState`, `hit`, `getAiSettings`, `chatCompletion`, `costForUsage`, `spendPoints`, and the Task-1 builders.

- [ ] **Step 1: Write the failing test** — mock all deps + `@/lib/extension/prompts`. Cases: 401 (no/bad token); 429 (rate-limited, mock `hit` false); 403 (inactive); 402 (points 0); 400 (unknown `feature`); 200 metadata happy path — asserts the matching builder was called with the structured inputs, `chatCompletion` called with a `messages` array whose user content includes the image `image_url` and the built prompt text, then `spendPoints`, returns `{ ok, content, usage, pointsBalance }`; 200 keyword path — text-only messages (no image_url); 502 when `chatCompletion` throws (no spend); 413 when the image data exceeds the cap. (Mock builders to return `{ prompt:"P", maxTokens: 1234 }`.)

- [ ] **Step 2: Run RED** — `npm test -- tests/lib/extension-generate-route.test.ts` → FAIL (module missing).

- [ ] **Step 3: Create `src/app/api/extension/generate/route.ts`**

```ts
import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";
import { chatCompletion } from "@/lib/agent/claude-client";
import { costForUsage } from "@/lib/agent/pricing";
import { spendPoints } from "@/lib/points";
import { hit } from "@/lib/rate-limit";
import {
  buildMetadataPrompt, buildScoringPrompt, buildCommercialIntentPrompt,
  buildKeywordPrompt, buildRejectPrompt,
} from "@/lib/extension/prompts";

export const maxDuration = 60;
const MAX_IMAGE_CHARS = 12_000_000;

function bearerToken(request: Request): string | null {
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function buildPromptFor(feature: string, b: any): { prompt: string; maxTokens: number } | null {
  switch (feature) {
    case "metadata": return buildMetadataPrompt({ marketplace: b.marketplace, promptMode: b.promptMode, batchIndex: b.batchIndex });
    case "scoring": return buildScoringPrompt({ marketplace: b.marketplace });
    case "commercial_intent": return buildCommercialIntentPrompt({ marketplace: b.marketplace });
    case "keyword": return buildKeywordPrompt({ marketplace: b.marketplace, monthsCurrent: b.monthsCurrent, monthsNext: b.monthsNext, referenceDate: b.referenceDate });
    case "reject": return buildRejectPrompt({ marketplace: b.marketplace, contextSnippet: b.contextSnippet });
    default: return null;
  }
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const rl = hit(`extgen:${resolved.userId}`, 90, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });

  const state = await getExtensionAccountState(resolved.userId);
  if (!state.active) return NextResponse.json({ ok: false, error: "inactive" }, { status: 403 });
  if (state.pointsBalance <= 0) return NextResponse.json({ ok: false, error: "no_points" }, { status: 402 });

  const body = await request.json().catch(() => null);
  const feature = body?.feature;
  const built = body ? buildPromptFor(feature, body) : null;
  if (!built) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  let content_;
  if (feature === "keyword") {
    content_ = built.prompt;
  } else {
    const img = body.image;
    if (!img?.mime || !img?.dataBase64) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    if (String(img.dataBase64).length > MAX_IMAGE_CHARS) return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    content_ = [
      { type: "text", text: built.prompt },
      { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.dataBase64}` } },
    ];
  }
  const messages = [{ role: "user", content: content_ }];

  const { model, apiKey } = await getAiSettings();
  if (!apiKey) return NextResponse.json({ ok: false, error: "ai_not_configured" }, { status: 503 });

  let result;
  try {
    result = await chatCompletion({ messages, model, apiKey, maxTokens: built.maxTokens });
  } catch (err) {
    console.error("[extension/generate] upstream error", err);
    return NextResponse.json({ ok: false, error: "ai_error" }, { status: 502 });
  }

  const cost = costForUsage({ model: result.model, usage: result.usage });
  let pointsBalance = state.pointsBalance;
  try { pointsBalance = await spendPoints({ userId: resolved.userId, cost, note: `Extension ${feature}` }); }
  catch (err) { console.error("[extension/generate] spend failed", err); }

  return NextResponse.json({ ok: true, content: result.text, usage: result.usage, pointsBalance });
}
```

- [ ] **Step 4: Run GREEN** — `npm test -- tests/lib/extension-generate-route.test.ts` → PASS; `npm test` once (only the 2 pre-existing failures).

- [ ] **Step 5: Commit** — `git add src/app/api/extension/generate/route.ts tests/lib/extension-generate-route.test.ts` → `feat: structured metered generate endpoint (server-built prompts)`.

---

### Task 3: Extension — call the structured endpoint; remove local prompts (`nerona_medata`)

**Files:** Modify `access/nerona-web-client.js`, `content.js`.

- [ ] **Step 1: `nerona-web-client.js`** — add `generateFeature(payload)`: `POST {base}/api/extension/generate` with `Authorization: Bearer <token>`, body = `payload` (JSON). Same fail-closed error mapping as the old `generate` (401→unauthorized, 402→no_points, 403→inactive, 413→payload_too_large, else network/ai_error). Return `{ ok, content, usage, pointsBalance }`. Export it on `NeronaWebClient`. (Remove the old `generate(messages)` once content.js no longer uses it.)

- [ ] **Step 2: `content.js` — rewire the 5 sites** (READ each first; keep parse/normalization exactly):
  - `generateMetadataFromImage`: build the image `{ mime, dataBase64 }` from `imageElementToInlineData` (rename its `data`→`dataBase64` in the payload), then `const aiResult = await mapUsage(NeronaWebClient.generateFeature({ feature:"metadata", marketplace, promptMode, batchIndex: options.batchIndex, image }))`. Drop the local `prompt`/hint/`METADATA_AI_CAPS` assembly. Keep everything after (parse/normalize/fill) unchanged. `mapUsage` converts `{promptTokens,completionTokens}`→`{prompt,completion,total}` (as `callAiForMetadata` did) and throws `neronaGenerateErrorMessage(r.error)` on `!ok`.
  - Scoring (`runAiScoringAgent`), Commercial Intent, Reject (`generateRejectAnalysisFromImage`): same pattern with `feature:"scoring"|"commercial_intent"|"reject"`, sending `image` (+ `contextSnippet` for reject); keep their parse/UI.
  - Keyword (`runEventKeywordResearch`): `feature:"keyword"`, send `marketplace`, `monthsCurrent: months.current`, `monthsNext: months.next` (no image); keep its parse.
  - Introduce one small helper `callGenerate(payload)` in content.js that calls `NeronaWebClient.generateFeature`, maps usage, throws mapped error — reused by all 5 sites. `callAiForMetadata`/`callAiTextOnly` may become that helper or be deleted.
- [ ] **Step 3: Delete moved prompt code from content.js** — remove `METADATA_GENERATOR_PROMPT_QUICK/ADVANCED`, `getMetadataGeneratorPrompt`, `getMetadataAiCaps`, `AI_SCORING_AGENT_PROMPT`+`SCORING_AI_CAPS`, `COMMERCIAL_INTENT_ANALYZER_PROMPT`+`COMMERCIAL_INTENT_AI_CAPS`, `MICROSTOCK_EVENT_KEYWORD_RESEARCH_PROMPT`+`KEYWORD_AI_CAPS`, the reject prompt string, and the per-marketplace hint / batch-index hint literals — ONLY after grep confirms they're no longer referenced (the builders are server-side now). KEEP all parsing/normalization (`safeJsonParse`, `metadataFromParsedAi`, `normalizeMetadataForMarketplace`, keyword sanitizers, marketplace field-fill).

- [ ] **Step 4: Verify** — `node --check content.js access/nerona-web-client.js`; committed content.js blob `node --check`; `grep -n "METADATA_GENERATOR_PROMPT\|AI_SCORING_AGENT_PROMPT\|COMMERCIAL_INTENT_ANALYZER_PROMPT\|MICROSTOCK_EVENT_KEYWORD_RESEARCH_PROMPT" content.js` → 0; confirm parse/normalize functions still present; confirm `generateFeature` used at all 5 sites.

- [ ] **Step 5: Commit (isolate)** — cherry-stage content.js hunks (commit WITHOUT pathspec after staging); `git add access/nerona-web-client.js`; `chore: extension sends structured inputs to /generate; prompts removed from content.js` (verify committed blob).

---

### Task 4: Batch runner — up to 50, concurrency 3, skip+summarize (`nerona_medata`)

**Files:** Modify `content.js` (the selected-assets generate loop).

- [ ] **Step 1: Locate the batch loop** — the function that iterates selected/checked assets calling `generateMetadataFromImage` per asset (search "antrian"/batch/selected). READ it.

- [ ] **Step 2: Concurrency pool of 3** — run generation with at most 3 in flight (a simple pool: kick off up to 3, as each finishes start the next). Cap the batch at 50 items (if more selected, process the first 50 and note it). Pass `batchIndex` per item (already used for the uniqueness hint).

- [ ] **Step 3: Skip-on-no-points + summary** — track a shared `pointsExhausted` flag. If a per-image call returns/throws the `no_points` error, set the flag; do NOT start new items once set (let in-flight ones finish). Other errors mark that item failed and continue. At the end, show a summary toast/panel: "Selesai: X berhasil, Y gagal (Z dilewati karena poin habis) dari N." Keep existing per-item progress UI.

- [ ] **Step 4: Verify** — `node --check content.js`; committed blob `node --check`. Manual: select >3 images (ideally test the pool) → confirm ~3 run concurrently, forms fill, points drop; simulate no-points → remaining skipped + summary shown.

- [ ] **Step 5: Commit (isolate)** — cherry-stage content.js hunk; `feat: batch generate up to 50 images, 3 concurrent, skip+summarize on no-points`.

---

### Task 5: Retire the raw-`messages` endpoint (nerona-web)

**Files:** Delete `src/app/api/extension/ai/route.ts` + `tests/lib/extension-ai-route.test.ts`.

- [ ] **Step 1: Confirm no client** — the extension now uses `/api/extension/generate`; grep the extension for `/api/extension/ai` → 0 (after Task 3). If any reference remains, fix it first.
- [ ] **Step 2: `git rm`** the route + its test. (`chatCompletion` stays — used by `/generate`.)
- [ ] **Step 3: Verify** — `npm test` (suite green except the 2 pre-existing `orders.test.ts` failures); `npm run build` succeeds (route removed cleanly).
- [ ] **Step 4: Commit** — `chore: remove raw-messages /api/extension/ai (superseded by /generate)`.

---

## Self-Review Notes
- **Spec coverage:** verbatim prompt port + parity tests (Task 1); structured metered endpoint w/ gates + image handling (Task 2); extension rewire to structured inputs + local-prompt removal, parse/normalize kept (Task 3); batch ≤50 @ concurrency 3 + skip/summarize (Task 4); retire raw endpoint (Task 5).
- **Prompt-unchanged guarantee:** Task 1 parity tests snapshot the exact strings; Task 3 removes the originals only after the server reproduces them.
- **Security:** client sends only structured inputs; server owns prompt/model/maxTokens; token+active+points+rate(90/min)+image-size gated; admin key server-side.
- **Type/shape consistency:** `build*Prompt`→`{prompt,maxTokens}` (Task 1) consumed by the route (Task 2); `chatCompletion`/`costForUsage`/`spendPoints`/`getExtensionAccountState`/`hit` reused unchanged; extension `generateFeature` payload matches the route body; `{content,usage,pointsBalance}` consumed by content.js exactly as the old `generate` was.
- **Two repos:** Tasks 1,2,5 in nerona-web; Tasks 3,4 in nerona_medata (cherry-staged content.js, committed-blob verified).
