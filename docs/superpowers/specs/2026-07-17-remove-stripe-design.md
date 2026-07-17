# Remove Stripe, Add Manual Access Grants

Date: 2026-07-17

## Purpose

Stripe was never actually launched — `.env.local` never got real price IDs for either the Pro
subscription (from the 2026-07-15 checkout/license plan) or the two video courses (built in an
uncommitted follow-on session), so no live payment has ever gone through. The decision now is to
stop pursuing Stripe entirely: payment moves off-platform (bank transfer, invoice, chat, whatever
channel the business already uses), and an admin manually grants the buyer access afterward.

The data model already anticipated this — `License.source` and `Enrollment.source` both accept
`"manual_grant"`, and `License` already carries `grantedById`/`notes` — but no admin UI or API
exists to actually perform a grant. This phase removes every Stripe-specific code path and schema
field, and builds the manual-grant admin feature that replaces it.

## Explicitly out of scope

- Any payment processor integration, Stripe or otherwise. Payment is fully off-platform.
- License expiry / time-limited grants. Manual grants are active until an admin revokes them —
  no `validUntil` is ever set by this phase's code (the column stays, for a future phase, but
  nothing writes to it).
- A generalized CMS for editing `Plan`/`Course` content. `priceLabel` (introduced below) is
  seed-script-managed, same as the rest of `Plan`/`Course` fields today.
- Multiple admin roles/permissions for grants — any user with `AdminRole` (existing
  `requireAdmin` guard) can grant/revoke anything, same as the rest of `/admin` today.
- Editing or deleting past `Order` ledger rows once created.

## Data Model Changes

- **Remove `Subscription` model entirely.** It only existed to mirror Stripe's recurring-billing
  state (`status`, `currentPeriodEnd`, `pastDueSince`); with no recurring billing there's nothing
  to mirror. `User.subscriptions` relation is removed.
- **`Plan`**: drop `stripePriceIdMonthly`, `stripePriceIdYearly`. Add `priceLabel String?` — a
  freeform display string (e.g. `"$29/month"`), seed-managed. `name`, `marketplaces`,
  `rejectAnalyzer` are unchanged, still the defaults copied onto a `License` at grant time.
- **`License`**: no schema change. Grants use the existing `source: "manual_grant"`,
  `grantedById`, `notes`, `status: "active" | "revoked" | "comp"`. `validUntil` stays `null`
  (active-until-revoked).
- **`Course`**: drop `stripePriceId`. Add `priceLabel String?`, same pattern as `Plan`.
- **`Enrollment`**: no schema change — already has `source: "manual_grant"`.
- **`Order`**: repurposed from a Stripe-invoice ledger into a generic manual-payment ledger. Drop
  `stripeInvoiceId`, `stripeCheckoutSessionId`, `status`, `refunded` (all Stripe-lifecycle
  concepts with no manual equivalent). Add `note String?`. Keep `userId`, `amount`, `currency`,
  `courseId String?` (null means the payment was for a Pro license grant, not a course),
  `createdAt`. Written once per grant action, only when the admin supplies an amount (amount is
  optional — see below).

One Prisma migration covers all of the above (`prisma/schema.prisma` edit + `prisma migrate dev`
generating the migration; no data backfill needed since no row in any dropped/changed column is
real production data — everything so far is test/seed data against a database that was never
launched).

## Code Removed

- `src/lib/stripe.ts`, `src/lib/stripe-webhooks.ts`, `src/lib/checkout.ts`,
  `src/lib/billing-portal.ts`, `src/lib/course-checkout.ts`, `src/lib/license-status.ts` (the last
  one is dead code once `Subscription` is gone — it only computed status from subscription
  lifecycle events).
- `src/app/api/webhooks/stripe/`, `src/app/api/checkout/`, `src/app/api/billing-portal/`,
  `src/app/api/learn/checkout/` (route directories, removed entirely).
- `src/components/learn/CourseBuyButton.tsx`.
- Matching test files: `tests/lib/checkout.test.ts`, `tests/lib/billing-portal.test.ts`,
  `tests/lib/stripe-webhooks.test.ts`, `tests/lib/course-checkout.test.ts`,
  `tests/lib/license-status.test.ts`.
- `package.json`: remove the `stripe` dependency. Keep `@vimeo/player` (lesson playback is
  unaffected by this change).
- `.env.example`/`.env.local`: remove all `STRIPE_*` vars.

## UI Changes

- **`/pricing`**: becomes static — plan name, `priceLabel`, the existing feature description, no
  interval toggle, no button, no auth requirement to view (unchanged).
- **`/learn/[slug]`**, not-enrolled state: course info + `priceLabel`, no buy button. The
  `CourseBuyButton` import is removed from the page; the not-enrolled branch just renders text.
- **`/account`**: `LicenseSection` drops the "Manage billing" button and the
  `POST /api/billing-portal` call. Still shows license key (copy-to-clipboard), plan name, status,
  `validUntil` (will typically be blank for manual grants).

## New Feature: Admin Manual Grants

### `src/lib/admin-grants.ts`

Four functions, each taking the acting admin's `User.id` (for `grantedById` / the `Order.note`
audit trail — revoke doesn't need a `grantedById` since `License`/`Enrollment` don't track who
revoked, only who granted):

- `grantLicense(adminId, userEmail, { note?, amountCents?, currency? }): Promise<GrantResult>` —
  looks up the user by email (404-equivalent result if not found); finds-or-reuses their existing
  `License` row if one exists (update `status: "active"`, `source: "manual_grant"`,
  `grantedById: adminId`, `notes`), otherwise creates one with a freshly generated license key
  (reusing `generateLicenseKey` from `src/lib/license.ts`). If `amountCents` is given, creates an
  `Order` row (`courseId: null`).
- `revokeLicense(userEmail): Promise<RevokeResult>` — looks up the user's `License` via
  `findFirst` (same lookup the account page already uses; the app only ever has one `License` row
  per user) and sets `status: "revoked"`. Not-found user or not-found license both return a
  `{ ok: false }` result rather than throwing.
- `grantEnrollment(adminId, userEmail, courseId, { note?, amountCents?, currency? })` — looks up
  user and course; upserts an `Enrollment` (unique on `userId_courseId`, matching the existing
  `handleCourseCheckoutCompleted` pattern) with `source: "manual_grant"`. If `amountCents` given,
  creates an `Order` row (`courseId` set).
- `revokeEnrollment(userId, courseId): Promise<void>` — deletes the `Enrollment` row (no
  "revoked" state on `Enrollment` today — deleting is equivalent to never having enrolled, and
  `hasEnrollment` already just checks row existence).

### API routes (all under `requireAdmin`, mirroring the guard already used by `/admin`)

- `GET /api/admin/users/search?email=...` — returns the matching user (id, email, name), their
  `License` (if any), and their `Enrollment` list joined to `Course` (slug, title). Powers the
  admin screen's lookup.
- `POST /api/admin/licenses` — body `{ userEmail, action: "grant" | "revoke", note?, amountCents?,
  currency? }`. `note`/`amountCents`/`currency` are only read when `action: "grant"`.
- `POST /api/admin/enrollments` — body `{ userEmail, courseId, action: "grant" | "revoke", note?,
  amountCents?, currency? }`, same rule for the optional fields.

### `/admin` page

Adds a "Users" panel below the existing "Signed in as..." line: an email search box; on match,
shows the user's License card (status, grant/revoke button, note+amount inputs) and an Enrollment
row per existing `Course` (enrolled/not, grant/revoke button, note+amount inputs). Client component
(`AdminUserPanel`), calling the routes above — same fetch-and-redirect-on-401 pattern used
elsewhere in the app, except 401 here means "not an admin" (shouldn't happen, `requireAdmin`
already gated the page server-side) so it just shows an error state rather than redirecting.

## Testing

- `tests/lib/admin-grants.test.ts`: grant creates a new License/Enrollment; grant on an
  already-licensed/enrolled user updates in place rather than duplicating; revoke sets
  `status: "revoked"` / deletes the `Enrollment`; `Order` row is created only when `amountCents`
  is supplied; grant with an unknown email returns a not-found result without throwing.
- Existing tests referencing removed code (`checkout.test.ts`, `billing-portal.test.ts`,
  `stripe-webhooks.test.ts`, `course-checkout.test.ts`, `license-status.test.ts`) are deleted, not
  updated.
- `tests/lib/course-access.test.ts`, `tests/lib/lesson-progress.test.ts` are unaffected (they
  don't touch Stripe).

## Migration / Rollout Notes

Nothing is live yet — no real user has a `Subscription`, Stripe `License`, or Stripe-sourced
`Enrollment` in the database (confirmed: `.env.local` never had real Stripe price IDs, so no
checkout ever completed). The schema migration is a clean drop/add with no data to preserve or
backfill.
