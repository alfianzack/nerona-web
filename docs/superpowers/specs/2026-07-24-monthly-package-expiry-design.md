# Monthly Package Expiry — Design

**Date:** 2026-07-24
**Status:** Approved (proceeding to plan per user)

## Summary

Paid packages are monthly. When a package is activated, it is valid **until the end of
the current calendar month** (Asia/Jakarta); at the start of the new month it expires. On
expiry the functionality is **fully stopped** until an admin re-activates (i.e. the next
month's payment).

- **WhatsApp Agent** (Pro/Business): expiry is **enforced** in this app — the agent
  refuses to process messages once expired.
- **Metadata license**: expiry is **tracked** here (a `validUntil` date is set on
  activation and shown in the UI) but **not enforced** by this app — the Chrome extension
  validates licenses against a Google Sheet / Apps Script, not this database. Enforcement
  will move to the database later; this spec only prepares the data + display.

Points wallet is unaffected and independent (prepaid, does not reset monthly).

## Expiry rule

- Expiry instant = the first moment of the **next** calendar month in **Asia/Jakarta**
  (fixed UTC+7, no DST). A package is valid while `now < expiresAt`.
- Applies regardless of activation day: activating on the 28th expires at month-end (as
  requested). Re-activation each month resets it to that month's end.
- **Free** agent plan never expires (`planExpiresAt = null`); expiry applies only to the
  paid plans `pro` / `business`.
- **Legacy grandfathering:** a paid plan with `planExpiresAt = null` (activated before
  this feature) is treated as NOT expired, so deploying this does not suddenly cut off
  current paying tenants. Their next admin re-activation starts the monthly cycle.

## Data model

- Add `AgentProfile.planExpiresAt DateTime?` (null = no expiry / free / legacy). Migration.
- Metadata: reuse the existing `License.validUntil DateTime?` (already present, currently
  only displayed) — now populated on grant.

## Backend

### `src/lib/billing-period.ts` (new, pure)
- `monthlyExpiryFrom(now: Date): Date` — the UTC instant of next month's 1st 00:00 in
  WIB (UTC+7). Handles Dec→Jan rollover. Computation:
  `wib = now + 7h; boundary = Date.UTC(wib.year, wib.month + 1, 1) - 7h`.
- `isExpired(expiresAt: Date | null, now: Date): boolean` — `expiresAt != null && now >= expiresAt`.

### Agent plan helper (in `src/lib/agent/admin.ts` or a small agent util)
- `PAID_AGENT_PLANS = ["pro", "business"]`.
- `isAgentPlanExpired(profile: { plan: string; planExpiresAt: Date | null }, now = new Date()): boolean`
  = `PAID_AGENT_PLANS.includes(profile.plan) && isExpired(profile.planExpiresAt, now)`.
  (Free plan and null-expiry paid plans → false.)

### Set expiry on activation
- `src/lib/orders.ts` `fulfillOrderRequest` (agent branch): set
  `planExpiresAt: monthlyExpiryFrom(new Date())` alongside `status:"active", plan` (the
  agent branch only ever grants paid plans).
- `src/lib/orders.ts` free activation path (sets `plan:"free"`): set `planExpiresAt: null`.
- `src/lib/agent/admin.ts` `activateAgentProfile(userEmail, plan?)`: when `plan` is paid →
  set `planExpiresAt = monthlyExpiryFrom(now)`; when `plan === "free"` → `null`; when
  `plan` is undefined (activate without changing plan) → leave `planExpiresAt` untouched.
- Metadata: `src/lib/admin-grants.ts` `grantLicense` → set
  `validUntil: monthlyExpiryFrom(new Date())` on both the update and create branches.

### Enforce (agent only) — `src/lib/agent/webhook-handler.ts`
Add a gate AFTER the phone-verified block and BEFORE the monthly-message-limit check:
```
if (isAgentPlanExpired(profile)) {
  await replyStatic(phone, profile.id,
    `Paket Anda sudah berakhir. Silakan perpanjang di ${baseUrl()}/agent untuk melanjutkan.`);
  return { status: 200 };
}
```
This is a normal static reply (like the existing quota-exceeded reply); no job is
enqueued, nothing is downgraded in the DB (lazy enforcement — robust without a cron).

Resulting agent gate order: profile exists → status active → phone verified → **not
expired** → under monthly message quota → (job) points balance > 0.

## UI (tracking/visibility)

Tenant **Finance page** (`/finance`) gains a small **Paket** section at the top showing:
- Agent: plan label + "Berlaku sampai <date>" (from `planExpiresAt`), or "Tidak aktif"
  when free/none; a clear "Berakhir" note when expired.
- Metadata license (if any): plan + "Berlaku sampai <validUntil>".

No admin UI change is required (the admin dashboard already lists licenses "expiring
soon" via `validUntil`, which now gets populated; agent `planExpiresAt` is visible via
the same Finance data if needed later).

## Error handling / edge cases

- Expired paid agent plan → static "paket berakhir" reply, message not processed.
- Free / null-expiry (legacy) paid plan → not blocked.
- Month boundary computed in WIB; a message exactly at the boundary instant is expired
  (`now >= expiresAt`).

## Testing

- `billing-period.ts`: `monthlyExpiryFrom` returns next-month 1st 00:00 WIB for a
  mid-month date, for a Dec date (→ Jan next year), and near a month boundary; `isExpired`
  true/false incl. null.
- `isAgentPlanExpired`: paid+past → true; paid+future → false; paid+null → false;
  free+past → false.
- `webhook-handler`: expired paid profile → renewal reply, `createJob` NOT called; active
  non-expired paid profile → proceeds to quota/job; free profile → not blocked by expiry.
- `fulfillOrderRequest` (agent) sets `planExpiresAt`; `grantLicense` sets `validUntil`.

## Not doing (YAGNI / later)

- Enforcing metadata expiry (extension reads Google Sheet; DB-driven enforcement is a
  later, separate change — this only sets/shows `validUntil`).
- A cron that flips expired profiles to `disabled` (lazy gating covers enforcement; a
  tidy-up cron can be added later for reporting).
- Per-tenant timezone for the boundary (fixed WIB/UTC+7).
- Pro-rating, grace periods, or "roll to next month if activated late" (explicitly chose
  end-of-current-month).
- Auto-downgrade to free on expiry (chose full stop).
