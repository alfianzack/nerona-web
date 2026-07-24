# Extension Legacy Cleanup + Keyword-AI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Keyword AI work via the nerona-web proxy, then remove the dead text-provider functions, decouple the enforce-gate from Google-Sheet config, and delete the Google-Sheet subsystem + Sumopod-gate chain — without breaking any live path or touching prompts.

**Architecture:** All extension AI now flows through `NeronaWebClient.generate` → nerona-web `/api/extension/ai` (metered); access gating flows through `NeronaWebClient.fetchAccountState`. This removes the last reasons the old Sheet/provider code existed.

**Tech Stack:** Plain MV3 JS in repo `nerona_medata` (branch `main`). NO test harness → verify with `node --check`, repo-wide `grep`, `JSON.parse` on manifest, and committed-blob checks.

## Global Constraints

- Work in `C:/Users/alfia/Documents/fahmi/project/produk/nerona/nerona_medata`. It has UNRELATED dirty files (`content.js`, `marketplaces/marketplace-miricanvas.js`, `marketplace-shutterstock.js`, `QA_CHECKLIST.md`). Commit ONLY the files each task edits, by EXPLICIT path; when a target file (esp. `content.js`) is dirty, isolate your hunk with `git apply --cached` and verify the COMMITTED blob (`git show <sha>:file > /tmp/x && node --check /tmp/x`). NEVER `git add -A`.
- **Locate code BY NAME** (grep), not by line number — `content.js` line numbers shift between tasks.
- **PROTECT (never remove/alter):** all prompt strings/builders, `generateMetadataFromImage`, `callAiForMetadata`, `neronaGenerateErrorMessage`, `NeronaWebClient` (whole file), `assertAccess`, `getStoredLicense`, `readCache`/`writeCache`, `normalizeMarketplaceList`, `ALL_MARKETPLACES`, `fetchAccessFromServer`'s NeronaWebClient-delegation branch, `canUseRejectAnalyzer`/`isRejectAnalyzerGranted`, `clearAccessCache`, `accessErrorMessage`, `ensureNeronaLicenseAccess`, `normalizeOpenAiStyleUsage`/`normalizeGeminiUsageMetadata`/`parseFiniteNumber`, everything in `marketplaces/*`, and `background.js`'s `NERONA_PROXY_FETCH` handler + `arrayBufferToBase64`. **Do not touch prompts or `messages` content.**
- After EACH task: `node --check` every edited JS file (working tree) + committed blob for cherry-staged files; `grep -rn` each removed symbol repo-wide → expect 0 remaining refs; confirm Protect symbols still present. If a planned removal is still referenced by a live path, KEEP it and report.

---

### Task 1: Migrate Keyword AI to the proxy (`content.js`)

**Files:** Modify `content.js` (`callAiTextOnly` only).

- [ ] **Step 1: Locate** — `grep -n "async function callAiTextOnly" content.js` and read the whole function + its one call site (`grep -n "callAiTextOnly(" content.js`, in `runEventKeywordResearch`). Confirm it currently dispatches to `callGeminiText`/`callOpenAiCompatibleText`/`callClaudeText`.

- [ ] **Step 2: Rewrite the body** — keep the signature `async function callAiTextOnly(settings, prompt, aiCaps)`; replace the whole body with a proxy call:

```js
async function callAiTextOnly(settings, prompt, aiCaps) {
  const messages = [{ role: "user", content: prompt }];
  const r = await NeronaWebClient.generate(messages);
  if (!r.ok) {
    throw new Error(neronaGenerateErrorMessage(r.error));
  }
  const u = r.usage
    ? {
        prompt: r.usage.promptTokens || 0,
        completion: r.usage.completionTokens || 0,
        total: (r.usage.promptTokens || 0) + (r.usage.completionTokens || 0)
      }
    : null;
  return { text: r.content || "", usage: u };
}
```
(`settings`/`aiCaps` become unused but the signature stays so the call site is untouched. `neronaGenerateErrorMessage` and `NeronaWebClient` are already in scope — same as `callAiForMetadata`.)

- [ ] **Step 3: Verify** — `node --check content.js` (working tree). Confirm the call site in `runEventKeywordResearch` is unchanged and still `await callAiTextOnly(settings, prompt, KEYWORD_AI_CAPS)`.

- [ ] **Step 4: Commit (isolate from dirty tree)** — cherry-stage ONLY the `callAiTextOnly` change: `git apply --cached` your hunk, then verify the committed blob: `git show :content.js` staged diff shows only this function changed; `git commit -m "feat: Keyword AI generates via nerona-web proxy (metered)"` (explicit path). Then `git show HEAD:content.js > /tmp/c.js && node --check /tmp/c.js`.

---

### Task 2: Remove dead text-provider functions (`content.js`)

**Files:** Modify `content.js`.

- [ ] **Step 1: Confirm dead** — after Task 1, `grep -n "callGeminiText\|callOpenAiCompatibleText\|callClaudeText" content.js`. Each must appear ONLY at its own definition (zero call sites). If any still has a caller, do NOT delete it; report.

- [ ] **Step 2: Delete** the three functions `callGeminiText`, `callOpenAiCompatibleText`, `callClaudeText` (locate each by `grep -n "function callGeminiText"` etc.; delete the full function body). Do NOT touch `normalizeOpenAiStyleUsage`/`normalizeGeminiUsageMetadata`/`parseFiniteNumber` (shared, still used by nothing now but harmless — leave them; they're tiny and referenced by the removed funcs only, so optionally remove ONLY if grep shows zero remaining refs after deleting the three text funcs — verify first).

- [ ] **Step 3: getAiSettings / aiSettings (best-effort)** — `grep -n "getAiSettings\|aiSettingsV2\|\"aiSettings\"" content.js`. If every remaining `getAiSettings()` call site is simply `const settings = await getAiSettings(); <call>(settings, …)` where `settings` is used for nothing else (it's ignored by `callAiForMetadata` and now by `callAiTextOnly`), THEN: drop those `getAiSettings()` calls (pass the existing first arg as `null`), and delete `getAiSettings` + its `aiSettingsV2`/`aiSettings` storage reads. If ANY call site uses `settings` for something else, LEAVE `getAiSettings` in place and note it (do not risk it).

- [ ] **Step 4: Verify** — `node --check content.js`; `grep -rn "callGeminiText\|callOpenAiCompatibleText\|callClaudeText" .` → 0; confirm `callAiForMetadata`, `callAiTextOnly`, `generateMetadataFromImage`, prompts all still present (`grep -c`). 

- [ ] **Step 5: Commit (isolate)** — cherry-stage only these deletions; commit `chore: remove dead text-provider functions from content.js` (explicit path); verify committed blob `node --check`.

---

### Task 3: Decouple enforce-gate + remove sheet/gate functions inside `access/access.js`

**Files:** Modify `access/access.js`.

- [ ] **Step 1: Rework `isAccessConfigured`** — `grep -n "function isAccessConfigured" access/access.js`; replace its body with:
```js
function isAccessConfigured() {
  return Boolean(String(cfg().neronaWebBaseUrl || "").trim());
}
```

- [ ] **Step 2: Trim `fetchAccessFromServer`** — keep ONLY the NeronaWebClient delegation; the function becomes:
```js
async function fetchAccessFromServer({ email, licenseKey, marketplaceKey }) {
  // nerona-web (akun & poin) menggantikan Google Sheet sebagai sumber akses.
  if (globalThis.NeronaWebClient) {
    return globalThis.NeronaWebClient.fetchAccountState(licenseKey);
  }
  return { ok: false, error: "server_not_configured" };
}
```
(NeronaWebClient is always loaded, so the fallback was dead; this keeps a safe closed default.)

- [ ] **Step 3: Trim `assertAccess`** — remove the now-dead lines: the leading `await pruneStaleAccessOverrides();`, and the `if (options.forceRefresh) { await clearSheetCsvCache(); }` block. Keep the rest (enforce check via `isAccessConfigured`, token check, cache read via `readCache`, `fetchAccessFromServer`, marketplace enforcement, `writeCache`). Read the function fully and keep every live branch.

- [ ] **Step 4: Delete the unreferenced sheet/apps_script/gate functions** — after Steps 1-3, these have no live caller (verify each with `grep -n` → only definition remains). Delete: `getAccessMode`, `getResolvedSheetCsvUrl`, `getResolvedConfigSheetCsvUrl`, `getBundledSumopodGateBearerToken`, `normalizeBearerToken`, `getResolvedSumopodGateBearerToken`, `extractSumopodGateBearerFromSheetCsvSources`, `readSheetGateBearerCache`/`writeSheetGateBearerCache`, `fetchAccessFromSheetCsv`, `requestAccessVerify`, `sendAccessMessage`, `sendSheetCsvFetchMessage`, `sendRuntimeMessage`, `downloadSheetCsvText`, `downloadSheetConfigCsvText`, `readSheetCsvCache`/`writeSheetCsvCache`, `readSheetConfigCsvCache`/`writeSheetConfigCsvCache`, `cacheGateBearerFromUsersCsvText`, `clearSheetCsvCache`, `getResolvedWebAppUrl`, `getResolvedApiToken`, `getStoredWebAppUrlOverride`/`getStoredApiTokenOverride`, `isHtmlAccessNetworkError`, `sanitizeUrlForDebug`, `clearAccessUrlOverrides`, `pruneStaleAccessOverrides`, `getBundledWebAppUrl`, `getBundledApiToken`, `normalizeWebAppUrl`, `isGasWebAppUrl`, `looksLikeSpreadsheetOrWrongUrl`, `isPlaceholderUrl`. Delete each ONLY after grep confirms zero live references. Also drop the `STORAGE_KEYS` entries `sheetCsvCache`, `sheetGateBearerCache`, `sheetConfigCsvCache`, `webAppUrl`, `apiToken` (keep `license`, `cache`). Remove the corresponding now-dead members from the `globalThis.NeronaAccess = { … }` export object (e.g. `clearSheetCsvCache`, `clearAccessUrlOverrides`, `getResolvedSumopodGateBearerToken`, `getAccessMode`, `getResolvedSheetCsvUrl`, `getResolvedConfigSheetCsvUrl`, `pruneStaleAccessOverrides`, `saveLicense`, `activateLicense`, `formatAccessStatus`, `fetchAccessFromServer` if it was exported and unused externally — but KEEP any member still used by content.js/popup.js: verify each export name with `grep -rn "NeronaAccess\.<name>" content.js popup.js background.js` before removing it).

- [ ] **Step 5: Also delete dead `saveLicense`/`activateLicense`/`formatAccessStatus`** (map confirms zero live callers: popup uses `NeronaWebClient.setToken` + `clearAccessCache` directly). Verify by grep, then remove them + their exports.

- [ ] **Step 6: Verify** — `node --check access/access.js`; `grep -rn` a sampling of removed names across `content.js`/`popup.js`/`background.js`/`marketplaces` → 0. Confirm PROTECT exports still present AND still referenced correctly: `grep -rn "NeronaAccess.assertAccess\|NeronaAccess.canUseRejectAnalyzer\|NeronaAccess.clearAccessCache\|NeronaAccess.ALL_MARKETPLACES\|NeronaAccess.getStoredLicense" content.js popup.js` still resolve to surviving definitions.

- [ ] **Step 7: Commit** — `git add access/access.js`; commit `refactor: decouple enforce-gate from sheet config; drop dead sheet/gate code in access.js`.

---

### Task 4: Remove the Sheet subsystem across files (sheet-csv.js, background, config, includes, docs)

**Files:** Delete `access/sheet-csv.js`; modify `manifest.json`, `background.js`, `access/access-config.js`, `popup.html`; delete `access/google-apps-script/` + sheet docs/templates.

- [ ] **Step 1: `background.js`** — remove `buildAccessVerifyUrl`, `handleAccessVerify`, `stripJsonResponseWrapper`, `extractJsonFromResponseText`, `describeNonJsonResponse`, `fetchSheetCsvText`, `handleSheetCsvFetch`, `handleSheetCsvAccess`, and the message listeners registering `NERONA_ACCESS_VERIFY`, `NERONA_ACCESS_SHEET_CSV_FETCH`, `NERONA_ACCESS_SHEET_CSV`, plus the `onInstalled`/`onStartup`/immediate calls to `pruneStaleAccessOverrides` (removed in Task 3). Remove `"access/sheet-csv.js"` from the top `importScripts(...)`. KEEP the `NERONA_PROXY_FETCH` listener + `arrayBufferToBase64` + `importScripts` of `access-config.js`, `nerona-web-client.js`, `access.js`. Verify each removed handler's message type has no live sender (`grep -rn "NERONA_ACCESS_VERIFY\|NERONA_ACCESS_SHEET_CSV" .` → 0 after Task 3).

- [ ] **Step 2: Delete `access/sheet-csv.js`** — `git rm access/sheet-csv.js`. First `grep -rn "NeronaSheetCsv" .` → all references were in the code removed in Task 3 / Step 1 (expect 0 live). If any `globalThis.NeronaSheetCsv?.` optional-chained ref remains in surviving code, it's safe (optional-chained → undefined), but prefer removing that ref too.

- [ ] **Step 3: `manifest.json`** — remove `"access/sheet-csv.js"` from the content-script `js` array. Keep `access-config.js`, `nerona-web-client.js`, `access.js` in order. `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('ok')"`.

- [ ] **Step 4: `popup.html`** — remove the `<script src="access/sheet-csv.js"></script>` include. Keep the other access script includes in order.

- [ ] **Step 5: `access/access-config.js`** — remove the sheet/apps_script/gate keys: `accessMode`, `spreadsheetId`, `sheetName`, `configSheetName`, `sheetCsvUrl`, `sheetCsvCacheTtlMs`, `webAppUrl`, `apiToken`, `sumopodGateBearerToken` (and any now-irrelevant comments). KEEP `neronaWebBaseUrl`, `enforce`, `cacheTtlMs`. Ensure the resulting object is valid JS.

- [ ] **Step 6: Delete dead docs/assets** — `git rm -r access/google-apps-script` and `git rm access/sheet-csv-README.md access/spreadsheet-config-template.csv access/spreadsheet-template.csv` (confirm none referenced by manifest/JS first).

- [ ] **Step 7: Verify** — `node --check background.js access/access.js access/access-config.js`; `JSON.parse` manifest; `grep -rn "sheet-csv\|NeronaSheetCsv\|NERONA_ACCESS_VERIFY\|NERONA_ACCESS_SHEET_CSV\|accessMode\|spreadsheetId\|sumopodGateBearerToken" .` → only harmless doc/README hits, zero in loaded JS/manifest. Confirm the extension's live scripts still load in order (manifest content_scripts + background importScripts): `access-config.js` → `nerona-web-client.js` → `access.js`.

- [ ] **Step 8: Commit** — `git add manifest.json background.js access/access-config.js popup.html` + the `git rm`'d paths; commit `chore: remove Google-Sheet access subsystem (sheet-csv, bg handlers, config, apps-script)`.

---

## Self-Review Notes
- **Spec coverage:** Keyword-AI proxy migration (Task 1); dead text-provider removal + best-effort getAiSettings (Task 2); enforce-gate decouple + access.js sheet/gate function removal (Task 3); cross-file Sheet-subsystem removal (Task 4).
- **Untested-codebase safety:** every task locates by name, keeps an explicit Protect list, and verifies via `node --check` (incl. committed blob for cherry-staged `content.js`), repo-wide `grep` for zero remaining refs, and JSON validity — plus "if still referenced, keep + report."
- **Live-path integrity:** the two live entry points (`assertAccess` gating; the four AI features + Keyword AI via `NeronaWebClient.generate`) are preserved; `fetchAccessFromServer` keeps its NeronaWebClient branch; `NERONA_PROXY_FETCH` + marketplaces + prompts untouched.
- **Consequence to note for the owner:** Keyword AI now consumes points (like all other AI). The `neronaWebBaseUrl` prod-vs-localhost release gate still applies.
