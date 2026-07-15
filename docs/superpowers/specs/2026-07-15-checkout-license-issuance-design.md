# Checkout & License Issuance

Date: 2026-07-15

## Purpose

The Foundation phase shipped auth (Google OAuth + email/password) but no way to actually buy
anything — the `Plan`/`Subscription`/`License`/`Order` tables exist in the schema but nothing
writes to them. This phase adds the core purchase flow described in the original design
(`docs/superpowers/specs/2026-07-14-nerona-website-design.md`): a pricing page, Stripe Checkout,
webhook-driven license issuance, and a customer-facing license view on `/account`.

This is an extension of the original design, not a replacement — the data model, the "Stripe
webhooks are the source of truth" decision, and the single-launch-plan scope are all unchanged,
only made concrete here.

## Explicitly out of scope (deferred to later phases)

- Admin panel: license/plan CRUD, manual license grants, refunds, `AdminRole` management. No UI
  for any of this exists yet; this phase only needs the data model to support it later without
  migration.
- The `/api/license/verify` endpoint and the companion `nerona_medata` extension changes — those
  depend on licenses already being issuable, which is what this phase delivers.
- Multiple plan tiers — `Plan` supports it, but only one "Pro" row is seeded.
- Preventing a signed-in user from starting a second Checkout Session while they already have an
  active license (client-side friction only, not a data-integrity issue — see Edge Cases).

## Before you start: one account only you can create

**Stripe (test mode):** go to https://dashboard.stripe.com, sign up (or use an existing account)
and switch to **test mode**. Create one product, "Nerona Pro", with two recurring prices:
monthly and yearly. Copy:
- The secret key (Developers → API keys) → `STRIPE_SECRET_KEY`
- The monthly and yearly Price IDs → `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY`

You'll also need the **Stripe CLI** (https://stripe.com/docs/stripe-cli) installed locally for
webhook forwarding during development — `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
prints a webhook signing secret → `STRIPE_WEBHOOK_SECRET`. This is separate from the dashboard's
webhook secret and only valid for the `stripe listen` session; a real deployed webhook endpoint
gets its own signing secret from the dashboard later (not needed for this phase's local dev/test
work).

## Data Model Changes

- `Subscription` gains `pastDueSince DateTime?` — set the first time a subscription's webhook
  reports `status: "past_due"` (not re-set on repeated `past_due` events for the same episode),
  cleared when the subscription returns to `active`/`trialing`. Drives the grace-period
  calculation below.
- `Subscription` also gains `stripeCustomerId String` — captured from the Checkout Session at
  creation time. Needed to open a Stripe Billing Portal session for a user (the Billing Portal
  API takes a Stripe customer ID, which isn't derivable from anything else already on `User` or
  `License`).
- `License.status` gains a new value, `"expired"` (alongside the existing `"active"`/
  `"revoked"`/`"comp"`) — set when a subscription lapses past its grace period or is canceled.
  `"revoked"` remains reserved for a future manual admin action; this phase never sets it.
- No other schema changes. `Plan`, `Subscription`, `License`, `Order` already have every field
  this phase needs.

## Stripe Setup & Seeding

- New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`,
  `STRIPE_PRICE_ID_YEARLY`.
- `npm run prisma:seed` is extended to also upsert one `Plan` row ("Pro", both Stripe price IDs
  from env, `marketplaces: "*"`, `rejectAnalyzer: true`) — idempotent, safe to re-run.

## Pricing Page & Checkout

- **`/pricing`**: static-ish page (Tailwind, no CMS) showing the "Pro" plan's name, a short
  feature blurb, and a monthly/yearly toggle with one "Subscribe" button per interval. No auth
  required to view.
- Clicking "Subscribe" when signed out redirects to `/login?callbackUrl=/pricing` first (reusing
  next-auth's existing callback-URL support — no new redirect logic needed).
- **`POST /api/checkout`**: authenticated route. Body: `{ interval: "monthly" | "yearly" }`.
  Looks up the seeded `Plan`, creates a Stripe Checkout Session (`mode: "subscription"`, the
  price ID for the requested interval, `customer_email` locked to the authenticated user's own
  session email — not user-editable, so the webhook can always resolve back to the right `User`
  — `success_url` back to `/account`, `cancel_url` back to `/pricing`), returns `{ url }`. The
  client redirects the browser to that URL.

## Webhook Handling

**`POST /api/webhooks/stripe`** — reads the raw request body (Next.js route config disables body
parsing for this route, required for Stripe signature verification), verifies the signature
against `STRIPE_WEBHOOK_SECRET` (400 on failure, before touching the payload). Handles three
event types:

- **`checkout.session.completed`**: look up `Subscription` by `stripeSubscriptionId` — if found,
  the event is a Stripe redelivery, no-op, return 200. Otherwise: find-or-create the `User` by
  the session's customer email (should already exist, since checkout requires sign-in), create
  the `Subscription` row (`status` and `currentPeriodEnd` from the session's subscription
  object), then find-or-create a `License` for that user — reusing an existing row (whatever its
  `source`) rather than creating a second one, updating only its `status`/`validUntil`/`planId`
  and leaving `source`/`grantedById`/`notes` untouched if the row already existed. Generate a new
  license key only if the row didn't already have one. Email the key via a new
  `sendLicenseEmail(email, licenseKey)` in `src/lib/mail.ts` (same pattern as the existing
  verification/reset emails).
- **`customer.subscription.updated`**: look up `Subscription` by `stripeSubscriptionId`; if
  missing, log and skip (we missed the checkout event — safer to no-op than guess at a
  `Subscription` row's other fields). Update `status`/`currentPeriodEnd`. Set or clear
  `pastDueSince` per the rule above. Recompute the linked `License.status`: `"active"` while
  `status` is `active`/`trialing`, or while `status` is `past_due` and within
  `PAST_DUE_GRACE_MS` (3 days, a named constant) of `pastDueSince`; otherwise `"expired"`.
- **`customer.subscription.deleted`**: same lookup; set `Subscription.status = "canceled"`,
  `License.status = "expired"`.
- **`invoice.paid`**: resolve `userId` via the invoice's `subscription` field (look up the
  existing `Subscription` by `stripeSubscriptionId`, already created by
  `checkout.session.completed`; if not found, log and skip — same reasoning as
  `customer.subscription.updated`) and create an `Order` row (`stripeInvoiceId`, `amount`,
  `currency`, `status`, `refunded: false`) — write-only in this phase; nothing reads `Order` yet.
- Any handler error is caught and logged with the Stripe event ID. Non-retryable failures (data
  we can't act on, e.g. a `Subscription` we don't recognize) return 200 so Stripe stops
  redelivering; transient failures (e.g. DB unreachable) return 500 so Stripe retries.

## Customer Portal (`/account`)

- Alongside the existing email-verification banner, `/account` gains a license section (for
  users who have a `License`): license key (monospace, copy-to-clipboard button), plan name,
  status, `validUntil`, and a "Manage billing" link.
- **`POST /api/billing-portal`**: authenticated route, looks up the user's most recent
  `Subscription` row for its `stripeCustomerId`, creates a Stripe Billing Portal session for
  that customer, returns `{ url }`; the "Manage billing" link redirects there. This is how
  customers self-serve cancel/upgrade — no custom UI for that.
- Users with no `License` yet see a "Subscribe" link to `/pricing` instead.

## Error Handling & Edge Cases

- **Manual-grant collision** (forward-compatible with the future admin panel): the webhook's
  find-or-create-by-user logic reuses whatever `License` row exists, so a future manually-granted
  license won't be duplicated when its owner later subscribes via Stripe.
- **Grace period boundary**: `pastDueSince` is set once per past-due episode, not on every
  `past_due` webhook delivery; License validity = no `pastDueSince`, or less than 3 days since
  it was set.
- **Duplicate checkout sessions**: a user can click "Subscribe" twice before the first webhook
  lands, creating two Stripe subscriptions — not prevented client-side in this phase. The
  webhook's find-or-create-by-user `License` logic means this doesn't create duplicate license
  keys, only (harmlessly, from the user's DB-facing perspective) a second `Subscription` row and
  an extra Stripe subscription the user would need to notice and cancel themselves via the
  Billing Portal. Accepted rough edge, not blocking for this phase.
- **Webhook/redirect race**: a customer redirected back to `/account` immediately after checkout
  may briefly see "no license yet" if the webhook hasn't landed. Acceptable — no polling added.

## Testing Strategy

- Unit tests (Vitest, mocked Prisma + mocked `stripe` SDK): license key generation (format,
  collision retry), the webhook handler's state-transition logic per event type (new checkout →
  license created and emailed; redelivered checkout event → no duplicate; `past_due` within
  grace → still `"active"`; `past_due` past grace → `"expired"`; `canceled` → `"expired"`), and
  signature-verification rejection (bad signature → 400, handler never invoked).
- Manual test-mode pass: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, run a
  real test-mode checkout, confirm `Subscription`/`License`/`Order` rows land correctly and the
  license-key email arrives via the Resend test account; trigger
  `customer.subscription.updated`/`.deleted` test events via the Stripe CLI and confirm the
  License updates accordingly.
- No new e2e browser suite, consistent with the existing project stance.
