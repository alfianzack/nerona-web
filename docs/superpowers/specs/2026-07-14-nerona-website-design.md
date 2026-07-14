# Nerona Website — Order & License Maintenance Platform

Date: 2026-07-14

## Purpose

Nerona Metadata (the Chrome extension) currently licenses users through a manually-maintained
Google Sheet, read either as a public CSV or via a Google Apps Script web app. There is no way
to sell a license automatically, no self-service for customers, and the AI quota gate tokens
(Sumopod) live in a spreadsheet readable by anyone with the link.

This project builds a website that:

1. Sells subscriptions to the extension (storefront/checkout).
2. Replaces the Google Sheet as the source of truth for licenses (maintenance/admin).
3. Gives customers a self-service portal for their own license and billing.
4. Provides a public marketing/pricing page.

This is the first real paid launch — the existing sheet only has test/demo rows, so **no data
migration is required**.

## Approach

Single unified Next.js (App Router, TypeScript) application serving all four areas
(marketing, storefront, customer portal, admin panel) behind role-gated routes, backed by one
Postgres database. Chosen over splitting admin into a separate app (unnecessary isolation
overhead for a small team) and over a Supabase/RLS-based backend (adds a second platform to
learn for no clear benefit here).

**Stack:**
- Next.js (App Router, TypeScript), Tailwind CSS
- Postgres (Neon) via Prisma
- Auth.js with Google OAuth (customers and admins are the same `User` model; admin access is
  granted via a separate role table, not a different login mechanism)
- Stripe (Checkout + Billing Portal + webhooks) for recurring subscriptions (monthly/yearly)
- Resend (or equivalent) for transactional email (license key delivery)
- Deployed on Vercel

## Data Model

- **User** — id, email, googleId, createdAt. Every authenticated person (customer or admin) is
  a User.
- **AdminRole** — userId, role (`owner_admin` | `support`). Presence in this table is what makes
  a User an admin; absence means they're just a customer. There must always be at least one
  `owner_admin` — removing the last one is blocked.
- **Plan** — id, name, stripePriceIdMonthly, stripePriceIdYearly, marketplaces (list or `*`),
  rejectAnalyzer (bool). Launch scope is a single "Pro" plan (monthly + yearly, all
  marketplaces), but the model supports adding tiers later without code changes.
- **Subscription** — id, userId, planId, stripeSubscriptionId, status
  (`active`/`trialing`/`past_due`/`canceled`), currentPeriodEnd. Mirrors Stripe state via
  webhooks; not read directly by the extension.
- **License** — id, userId, licenseKey, status (`active`/`revoked`/`comp`), source
  (`stripe`/`manual_grant`), grantedBy (admin userId, when manually granted), notes. This is
  what the extension actually verifies against. Kept separate from `Subscription` so a
  manually-granted comp/trial/VIP license doesn't require a fake Stripe record.
- **Order** — mirrors Stripe invoice/charge events (id, userId, stripeInvoiceId, amount, status,
  refunded) for admin visibility and to drive refunds via the Stripe API.
- **Setting** — key/value store replacing the sheet's `config` tab
  (`sumopod_bearer_token`, `sumopod_bearer_token_keys`), editable only by `owner_admin`.

## Features

### Marketing site (`/`, `/pricing`, `/features`)
Static-ish pages: product description, supported marketplaces, screenshots, a pricing table
driven by the `Plan` table, and install/download instructions. No auth required.

### Storefront / checkout (`/checkout`)
"Subscribe" → Google OAuth sign-in if needed → Stripe Checkout Session (monthly or yearly
price). On the `checkout.session.completed` webhook: create/attach `User` → `Subscription` →
`License` (generating a license key if one doesn't already exist for that user), then email the
license key. Stripe's Billing Portal handles self-service cancel/upgrade without custom UI.

### Customer portal (`/account`, Google-OAuth-gated)
Shows license key (copy-to-clipboard, for pasting into the extension popup), plan, status,
`validUntil`, allowed marketplaces, and a "Manage billing" link into the Stripe Billing Portal.

### Admin panel (`/admin`, gated by `AdminRole`)
- **Owner/Admin:** full CRUD on `License`, `Plan`, `Setting` (AI gate tokens); refund orders;
  manage `AdminRole` (invite/remove team members); view all customers.
- **Support:** read-only customer/license search; "force re-check" action (bumps a version/
  timestamp on the license so the extension's cache treats it as stale); view order history.
  Cannot edit plans, tokens, or issue refunds.
- Manual license grant/extend form (comp/trial/VIP) with a required reason/notes field for
  audit purposes.

### Extension integration
Companion change to the existing `nerona_medata` extension repo — the website is only useful to
the extension once this lands:

- New endpoint `POST /api/license/verify` — takes `{ email, licenseKey, marketplace }`, returns
  the same payload shape the extension already expects (`ok`, `plan`, `validUntil`,
  `marketplaces`, `rejectAnalyzer`), plus the Sumopod gate bearer tokens **only when the license
  is valid**. This closes the current security gap where the tokens sit in a publicly-readable
  CSV.
- New `accessMode: "nerona_api"` in `access/access-config.js`, with a new
  `fetchAccessFromNeronaApi()` in `access/access.js` alongside the existing sheet_csv/apps_script
  paths. Existing modes can remain for a transition period since there's no forced migration.
- Error codes returned must match what `access.js` already understands
  (`invalid_key`, `expired`, `revoked`, `email_mismatch`, `marketplace_locked`,
  `server_not_configured`) so existing error-message handling keeps working unchanged.

## Error Handling & Edge Cases

- **Stripe webhooks are the source of truth for subscription state.** Verify signatures, make
  handlers idempotent (Stripe redelivers), and log failed events for manual replay instead of
  dropping them silently.
- **Payment failure (`past_due`):** don't revoke immediately. Rely on Stripe's dunning plus a
  short grace period (e.g. 3 days) before `/api/license/verify` starts returning `ok: false`, so
  a temporary card issue doesn't lock someone out mid-project.
- **Manual grant vs. real subscription collision:** if a user with a manually-granted license
  later subscribes via Stripe, the checkout webhook attaches to their existing `License` row
  (matched by user) instead of creating a duplicate.
- **Last admin removal:** removing the last remaining `owner_admin` is blocked.

## Testing Strategy

- Unit tests (Vitest) for license verification logic (status/expiry/marketplace checks) and
  Stripe webhook handlers — the parts where a bug directly breaks paying customers' access.
- Integration tests hitting `/api/license/verify` against a seeded test DB, covering every error
  code the extension relies on.
- Manual test-mode Stripe checkout pass (Stripe CLI webhook forwarding) before launch — payment
  flows are worth a hands-on verification pass rather than relying solely on mocks.
- No dedicated e2e browser suite at launch (small team, small surface); revisit if the admin
  panel grows more complex.

## Out of Scope (for this spec)

- Data migration tooling (not needed — no real users in the current sheet).
- Multi-currency / localized pricing.
- Fine-grained permissions beyond the two admin roles (`owner_admin`, `support`).
