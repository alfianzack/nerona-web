# Extension Legacy Cleanup + Keyword-AI Migration — Design

**Date:** 2026-07-24
**Status:** Approved (user: "rework sampai semua bisa berjalan")

## Summary

Finish the `nerona_medata` migration ([[nerona-metadata-web-sync-direction]]) so **everything
works** and the dead legacy code is gone:
1. **Fix "Keyword AI"** — currently live-but-broken (its text AI call needs a user API key the
   popup no longer provides). Route it through the nerona-web proxy like metadata generation
   (`NeronaWebClient.generate`), so it works and is metered by points.
2. **Remove the now-dead text-provider functions** (`callGeminiText`/`callOpenAiCompatibleText`/
   `callClaudeText`).
3. **Decouple the enforce-gate from Google-Sheet config** (`isAccessConfigured`), then **remove the
   Google-Sheet subsystem** and the dead Sumopod-gate bearer chain.

No test harness in the extension → verification is `node --check` (working tree AND the committed
blob for cherry-staged files), repo-wide `grep` proving removed symbols have zero remaining
references, and confirming the live entry points still resolve their dependencies. **Prompts are
NOT touched** ([[nerona-metadata-prompts-do-not-change]]).

## Protect (never remove / never change)
- All prompt strings/builders + `generateMetadataFromImage` + `callAiForMetadata` + `neronaGenerateErrorMessage`.
- `NeronaWebClient` (whole file) and its `generate`/`fetchAccountState`/`getToken`/`setToken`.
- Live gating in `access/access.js`: `assertAccess`, `getStoredLicense`, `readCache`/`writeCache`,
  `normalizeMarketplaceList`, `ALL_MARKETPLACES`, `fetchAccessFromServer`'s **NeronaWebClient
  delegation branch** (the first two lines), `canUseRejectAnalyzer`/`isRejectAnalyzerGranted`,
  `clearAccessCache`, `accessErrorMessage`.
- `content.js` `ensureNeronaLicenseAccess`; the usage normalizers `normalizeOpenAiStyleUsage`/
  `normalizeGeminiUsageMetadata`/`parseFiniteNumber`; all `marketplaces/*` + form-filling.
- `background.js` `NERONA_PROXY_FETCH` handler + `arrayBufferToBase64`.

## Changes

### 1. Keyword-AI migration (`content.js`)
Rewrite `callAiTextOnly(settings, prompt, aiCaps)` to ignore provider/apiKey and call the proxy:
build `messages = [{ role: "user", content: prompt }]`, call `await NeronaWebClient.generate(messages)`,
and return `{ text: r.content || "", usage: <normalized {prompt,completion,total}> }` on `r.ok`; on
`!r.ok` throw `new Error(neronaGenerateErrorMessage(r.error))` (reuse the same mapper used by
`callAiForMetadata`). Keep the function signature so its one call site (`runEventKeywordResearch`)
needs no change. (This makes Keyword AI work + metered; consequence: Keyword AI now costs points,
consistent with all other AI in the extension.)

### 2. Remove dead text providers (`content.js`)
After (1), `callGeminiText`, `callOpenAiCompatibleText`, `callClaudeText` have zero callers →
delete them. Re-confirm zero references by grep first. Leave `getAiSettings` + `aiSettingsV2`/
`aiSettings` reads for a later micro-cleanup ONLY IF removing them cleanly requires editing multiple
`callAiForMetadata`/`callAiTextOnly` call sites; if the call sites simply do
`const settings = await getAiSettings(); callX(settings, …)` with `settings` used nowhere else, also
remove `getAiSettings` + those reads and drop the now-unused arg. (Judgement call at implementation
time; prefer removal when clean, keep + note when risky.)

### 3. Decouple enforce-gate (`access/access.js`)
Change `isAccessConfigured()` to no longer depend on sheet/apps_script config:
```js
function isAccessConfigured() {
  return Boolean(String(cfg().neronaWebBaseUrl || "").trim());
}
```
`neronaWebBaseUrl` has a default (`http://localhost:3000`), so the gate stays satisfied; the REAL
gate remains the token check in `assertAccess` (`getStoredLicense` → `NeronaWebClient`). This lets the
sheet config be removed without breaking `assertAccess`.

### 4. Remove the Google-Sheet subsystem + Sumopod-gate chain
Guided by the read-only removal map already produced (see `.superpowers/sdd/` analysis). Remove, with
per-step `grep`+`node --check` verification and keeping every Protect item:
- `access/access.js`: the `fetchAccessFromServer` fallback (everything AFTER the NeronaWebClient
  delegation return), and every sheet/apps_script/gate-only function that becomes unreferenced
  (`fetchAccessFromSheetCsv`, `requestAccessVerify`, `sendAccessMessage`, `sendSheetCsvFetchMessage`,
  `download*CsvText`, `read/writeSheetCsvCache`, `read/writeSheetConfigCsvCache`,
  `cacheGateBearerFromUsersCsvText`, `getResolved{WebAppUrl,ApiToken,SheetCsvUrl,ConfigSheetCsvUrl}`,
  `getStored{WebAppUrl,ApiToken}Override`, `isHtmlAccessNetworkError`, `sanitizeUrlForDebug`,
  `clearAccessUrlOverrides`, `getAccessMode`, and the Sumopod-gate chain
  `getResolvedSumopodGateBearerToken`/`getBundledSumopodGateBearerToken`/
  `extractSumopodGateBearerFromSheetCsvSources`/`read/writeSheetGateBearerCache`/`normalizeBearerToken`).
  ALSO remove `pruneStaleAccessOverrides` + `getBundled{WebAppUrl,ApiToken}` + `normalizeWebAppUrl`/
  `isGasWebAppUrl`/`looksLikeSpreadsheetOrWrongUrl`/`isPlaceholderUrl` and their now-dead call sites
  in `assertAccess` (the `pruneStaleAccessOverrides()` call + `forceRefresh`/`clearSheetCsvCache`
  block) and `background.js` — ONLY after confirming nothing live calls them. Drop the
  `sheetCsvCache`/`sheetGateBearerCache`/`sheetConfigCsvCache`/`webAppUrl`/`apiToken` `STORAGE_KEYS`.
  Remove the now-unused exports on `globalThis.NeronaAccess`.
- Delete file `access/sheet-csv.js`; remove its `<script>`/`importScripts` includes in
  `manifest.json`, `background.js`, `popup.html`.
- `background.js`: remove `buildAccessVerifyUrl`, `handleAccessVerify`, `fetchSheetCsvText`,
  `handleSheetCsvFetch`, `handleSheetCsvAccess`, their helpers, and the message listeners for
  `NERONA_ACCESS_VERIFY`/`NERONA_ACCESS_SHEET_CSV_FETCH`/`NERONA_ACCESS_SHEET_CSV`. KEEP the
  `NERONA_PROXY_FETCH` handler.
- `access/access-config.js`: remove the sheet/apps_script/gate config keys (`accessMode`,
  `spreadsheetId`, `sheetName`, `configSheetName`, `sheetCsvUrl`, `sheetCsvCacheTtlMs`, `webAppUrl`,
  `apiToken`, `sumopodGateBearerToken`). KEEP `neronaWebBaseUrl`, `enforce`, `cacheTtlMs`.
- Delete the dead docs/assets: `access/google-apps-script/`, `access/sheet-csv-README.md`,
  `access/spreadsheet-config-template.csv`, `access/spreadsheet-template.csv`.
- If any listed symbol turns out to still be referenced by a live path, KEEP it and report — do not
  force the removal.

## Data flow (after)
- Access check: `assertAccess` → `isAccessConfigured` (true via neronaWebBaseUrl) → token from
  `getStoredLicense`/`NeronaWebClient` → `fetchAccessFromServer` → `NeronaWebClient.fetchAccountState`
  → `/api/extension/me`. No sheet path exists.
- Metadata gen + Scoring + Commercial-Intent + Reject-Analyzer + **Keyword AI**: all →
  `NeronaWebClient.generate` → `/api/extension/ai` (metered).

## Error handling / edge cases
- Keyword AI errors map through `neronaGenerateErrorMessage` (no_points/inactive/missing_license/
  unauthorized/payload_too_large/network/ai_error).
- After removal, `isAccessConfigured` never returns false in normal config → the old
  `server_not_configured` path is effectively unreachable but the message string stays.

## Testing / verification (no extension harness)
- After EACH task: `node --check` on every edited JS file (working tree) and on the committed blob
  for any cherry-staged (dirty) file; `grep -rn <removed-symbol>` repo-wide → 0 remaining refs;
  confirm the Protect symbols still present (grep count ≥ 1) and their transitive deps intact;
  `node -e "JSON.parse(...manifest.json)"`.
- Manual smoke (owner, before ship): connect token; run metadata generate AND Keyword AI → both hit
  `/api/extension/ai`, fill/return results, and drop the points balance; access still gates on
  active + points.

## Not doing
- Touching prompts or `messages` content.
- The `getAiSettings`/`aiSettings` removal is best-effort (see §2) — safe to leave if entangled.
- nerona-web side is unchanged (proxy already accepts arbitrary text `messages`).
