# Extension ↔ nerona-web Account Sync — Design

**Date:** 2026-07-24
**Status:** Approved (go straight to spec + implementation per user)

## Summary

Sub-project 2 of making the `nerona_medata` Chrome extension follow nerona-web
([[nerona-metadata-web-sync-direction]]). The extension connects to a nerona-web account
via a **pasted token**, and reads the user's **plan + license validity + points balance**
from a new nerona-web endpoint — **replacing the Google Sheet** as the license source and
enforcer. (AI generation still uses the old in-extension path; that's sub-project 3.)

Decisions locked: connect by **pasting a token** generated in the nerona-web Profile page;
enforcement is **nerona-web only** (Google Sheet dropped). This finally moves metadata
license enforcement into the DB, honoring the `License.validUntil` set by
[[nerona-monthly-package-expiry]].

⚠️ **Migration prerequisite:** because enforcement flips to nerona-web only, every active
extension user must already have a nerona-web account with an active license, or they lose
access. Ensure the data is migrated before shipping this to users.

## nerona-web

### Data model
New `ExtensionToken` (a revocable bearer credential; mirrors the existing token models):
```prisma
model ExtensionToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String    @unique
  label      String?
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
  @@index([userId])
  @@map("extension_tokens")
}
```
`User` gains `extensionTokens ExtensionToken[]`. Token stored as-is (plaintext, revocable —
consistent with the existing `PasswordResetToken`/license-key handling); format
`nrx_<48 hex>` via `crypto.randomBytes(24)`.

### `src/lib/extension-auth.ts` (new)
- `createExtensionToken(userId: string, label?: string): Promise<string>` — generates the
  `nrx_…` token, stores the row, returns the raw token.
- `resolveExtensionToken(token: string): Promise<{ userId: string } | null>` — looks up by
  token; on hit, best-effort updates `lastUsedAt`; returns `{ userId }` or null.
- `listExtensionTokens(userId)` / `revokeExtensionToken(userId, id)` — for the profile UI
  (revoke scoped to the owner).

### `src/lib/extension-sync.ts` (new)
`getExtensionAccountState(userId: string): Promise<{ email; plan: string | null;
licenseStatus: string | null; validUntil: Date | null; pointsBalance: number;
active: boolean }>`:
- license = `prisma.license.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { plan: true } })`.
- `pointsBalance = getBalance(userId)` (the [[nerona-points-wallet-feature]] wallet).
- `active = !!license && ["active","comp"].includes(license.status) && (license.validUntil == null || license.validUntil > now)`.
- `plan = license?.plan?.name ?? null`; `email` from the user.

### Endpoints
- **`GET /api/extension/me`** — auth via `Authorization: Bearer <token>` →
  `resolveExtensionToken`; 401 if missing/invalid. On success returns
  `{ ok: true, account: { email, plan, licenseStatus, validUntil (ISO|null), pointsBalance, active } }`.
  The extension calls this from its service worker/popup (the manifest already has
  `host_permissions: "https://*/*"`, so no CORS setup needed).
- **`POST /api/extension/tokens`** — session-guarded (`getServerSession`, must be a
  logged-in user; body `{ label? }`) → `createExtensionToken` → `{ ok: true, token }`
  (the raw token, shown once).
- **`DELETE /api/extension/tokens/[id]`** — session-guarded → `revokeExtensionToken(session.user.id, id)`.
- **`GET /api/extension/tokens`** — session-guarded → list (id, label, createdAt,
  lastUsedAt) for the profile UI. Never returns the raw token again.

### Profile UI
`src/components/account/ExtensionConnectPanel.tsx` (client), added to `/profile`:
- Explains connecting the extension. A "Buat token" button → `POST /api/extension/tokens`
  → shows the new token once in a copyable box with a "salin & simpan, tidak ditampilkan
  lagi" warning.
- Lists existing tokens (label/created/last-used) with a "Cabut" button each
  (`DELETE`). Indonesian copy.

## Extension (`nerona_medata`)

- **Config:** add `neronaWebBaseUrl` to `access/access-config.js` (user sets their deployed
  nerona-web URL; default `http://localhost:3000` for dev). Store the connect token in
  `chrome.storage` under `neronaToken`.
- **Client:** a small `access/nerona-web-client.js` — `fetchAccountState(baseUrl, token)`
  → `GET {baseUrl}/api/extension/me` with the Bearer header; returns the `account` object or
  an error. Token get/set helpers on `chrome.storage`.
- **Gating:** replace the Google-Sheet verification path used by `NeronaAccess.verifyAccess`
  (in `access/access.js` / `background.js`) so access is granted iff `account.active` from
  nerona-web. The Sheet-CSV/apps-script code path is no longer used for gating (left in the
  repo for now; full removal is cleanup, not required here).
- **Popup:** replace the license email/key inputs with a **"Token akun Nerona"** field +
  "Simpan & cek" button; on success show email / plan / "berlaku sampai" / points balance.
  The AI provider/model/API-key section stays untouched (sub-project 3). Indonesian copy.
- **Manifest:** no change (`host_permissions` already includes `https://*/*`).

## Data flow

1. User opens nerona-web `/profile` → "Buat token" → copies the `nrx_…` token.
2. In the extension popup, pastes it into "Token akun Nerona" → Simpan → extension stores it
   and calls `GET /api/extension/me`.
3. Popup shows plan + validUntil + points; the extension enables generation only when
   `account.active` is true.
4. On each session/verify, the extension re-checks `/api/extension/me` (cached briefly).

## Error handling

- Missing/invalid token → 401; popup shows "Token tidak valid / belum terhubung", access
  disabled.
- Network error to nerona-web → extension treats as not-verified (fail closed), shows a
  reconnect hint (does not silently allow).
- Revoked token → next `/me` call 401 → access disabled.
- Wrong `neronaWebBaseUrl` → fetch fails → same not-verified handling.

## Testing

- `extension-auth.ts` (vitest, mock prisma): `createExtensionToken` stores a `nrx_`-prefixed
  token and returns it; `resolveExtensionToken` returns `{ userId }` for a known token and
  null for an unknown one (and updates `lastUsedAt`); `revokeExtensionToken` only deletes a
  token owned by the caller.
- `extension-sync.ts`: `active` true for an active license with future/null validUntil;
  false for expired validUntil, revoked status, or no license; `pointsBalance` from
  `getBalance`.
- `GET /api/extension/me`: 401 without/with a bad token; 200 with the account state for a
  valid token.
- `POST /api/extension/tokens`: 401 unauthenticated; returns a token for a session user.
- Extension side has no test harness → verified manually (load unpacked, paste a token,
  confirm plan/points show and gating follows `active`). The plan lists explicit manual
  steps.

## Not doing (YAGNI / later)

- Removing the Google-Sheet code entirely (kept dormant; cleanup later).
- Moving AI generation server-side / points deduction (sub-project 3).
- launchWebAuthFlow OAuth-style connect (chose pasted token).
- Token hashing at rest (plaintext + revocable, consistent with existing token models).
- Dual-source enforcement bridge (chose nerona-web only).
