# Nerona Website

Order and license maintenance platform for the Nerona Metadata Chrome extension.

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — Supabase **pooled** connection string (port `6543`, "Transaction" mode,
     with `?pgbouncer=true`), from Project Settings → Database → Connection Pooling. Used by the
     app at runtime.
   - `DIRECT_URL` — Supabase **session-mode** connection string on the same pooler host (port
     `5432`, no `pgbouncer` param). Used only by Prisma CLI for migrations, since the transaction
     pooler doesn't support the features `prisma migrate` needs.
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev.
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from an OAuth 2.0 Client ID at
     https://console.cloud.google.com/apis/credentials (type "Web application"), with
     `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
   - `OWNER_ADMIN_EMAIL` — the Google account email that should get full admin access.
   - `RESEND_API_KEY` — from https://resend.dev (Dashboard → API Keys). Used to send
     verification and password-reset emails. Without a verified sending domain, Resend can
     only deliver to the email address your Resend account was created with.
   - `EMAIL_FROM` — optional, defaults to `"Nerona <onboarding@resend.dev>"`.
   - `STRIPE_SECRET_KEY` — from https://dashboard.stripe.com (test mode) → Developers → API
     keys.
   - `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY` — create one product ("Nerona Pro")
     with a monthly and a yearly recurring price in test mode, then copy each price's ID.
   - `STRIPE_WEBHOOK_SECRET` — run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
     (requires the Stripe CLI: https://stripe.com/docs/stripe-cli) and copy the webhook signing
     secret it prints. This secret is only valid for that `stripe listen` session — a real
     deployed webhook endpoint gets its own secret from the dashboard later, not needed for
     local development.
2. Set up your Stripe test-mode account: create the product and prices, and start
   `stripe listen` to get a webhook secret, as described above.
3. Install dependencies: `npm install`
4. Apply the database schema: `npm run prisma:migrate`
5. Start the dev server: `npm run dev`, and sign in with Google using the email you set as
   `OWNER_ADMIN_EMAIL` (this creates your `User` + linked `Account` row)
6. Grant yourself admin access: `npm run prisma:seed`. Sign out and back in afterward — sessions
   use JWTs, so your existing session's token won't reflect the new role until you get a fresh
   one.

Note: Prisma CLI commands always go through the `npm run prisma:*` scripts (not raw
`npx prisma ...`) because those scripts load secrets from `.env.local` via `dotenv-cli` — the
Prisma CLI itself only auto-loads a plain `.env` file.

## Testing

Run `npm test` for the unit test suite (session/role-guard logic). Payment and OAuth flows are
verified manually against Stripe/Google test modes — see later phase plans.

## Auth methods

Two ways to sign in: Google OAuth, or email/password (`/register`, `/login`). Email/password
accounts get a verification email on signup (`/verify-email`) and can reset their password via
`/reset-password`. Unverified accounts can still sign in and use `/account`, with a reminder
banner shown there until verified.

## Project structure

- `src/app` — Next.js App Router pages and API routes.
- `src/lib` — server-side helpers (Prisma client, auth config, session guards).
- `prisma/schema.prisma` — database schema.
- `docs/superpowers/specs/` — design specs.
- `docs/superpowers/plans/` — implementation plans, one per phase.
