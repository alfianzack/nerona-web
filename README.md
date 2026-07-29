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
2. Install dependencies: `npm install`
3. Apply the database schema: `npm run prisma:migrate`
4. Start the dev server: `npm run dev`, and sign in with Google using the email you set as
   `OWNER_ADMIN_EMAIL` (this creates your `User` + linked `Account` row)
5. Grant yourself admin access: `npm run prisma:seed`. Sign out and back in afterward — sessions
   use JWTs, so your existing session's token won't reflect the new role until you get a fresh
   one.

There is no payment processor integration — Pro licenses and course enrollments are granted
manually from `/admin` (search a user by email, grant/revoke their license or course access).
Payment happens off-platform; the admin grant is the only step that unlocks access.

Note: Prisma CLI commands always go through the `npm run prisma:*` scripts (not raw
`npx prisma ...`) because those scripts load secrets from `.env.local` via `dotenv-cli` — the
Prisma CLI itself only auto-loads a plain `.env` file.

## Testing

Run `npm test` for the unit test suite (session/role-guard logic). OAuth flows are verified
manually against Google test accounts — see later phase plans.

## Auth methods

Two ways to sign in: Google OAuth, or email/password (`/register`, `/login`). Email/password
accounts get a verification email on signup (`/verify-email`) and can reset their password via
`/reset-password`. Unverified accounts can still sign in and use `/account`, with a reminder
banner shown there until verified.

## Nerona Agent (WhatsApp AI assistant)

Additional setup beyond the base site:

1. Add to `.env.local`:
   - `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_APP_SECRET` /
     `WHATSAPP_VERIFY_TOKEN` — from a Meta app with the WhatsApp product added (see
     `docs/superpowers/plans/2026-07-19-nerona-agent-foundation.md` for the full walkthrough).
   - `WHATSAPP_DISPLAY_NUMBER` — the human-readable form of that number, shown to owners on
     `/agent`.
   - `SUMOPOD_API_KEY` — from https://ai.sumopod.com (AI tab → API Keys → Create key). The
     agent talks to Sumopod's OpenAI-compatible gateway, not Anthropic directly.
   - `SUMOPOD_BASE_URL` — defaults to `https://ai.sumopod.com/v1`.
   - `AGENT_MODEL` — defaults to `claude-sonnet-4-6` (a Sumopod model id). Switch to
     `claude-haiku-4-5` for cheaper/faster replies without any code change.
   - `CRON_SECRET` — generate with `openssl rand -base64 32`; also set as a Vercel project env
     var with the same name so Vercel Cron authenticates automatically.
2. For local development, expose `http://localhost:3000` with a tunnel (e.g. `ngrok http 3000`)
   and configure the tunnel's HTTPS URL + `/api/whatsapp/webhook` as the Meta app's webhook
   callback URL, subscribed to the `messages` field.
3. Activate a user's agent access from `/admin` ("Agent" section — Aktifkan), then have that
   user link their WhatsApp number from `/agent`.

Agent-specific unit tests live in `tests/lib/agent/`. The webhook and Claude tool loop are
verified manually against Meta's test number and test recipients — see the Phase 1 plan's
"complete when" checklist.

## Project structure

- `src/app` — Next.js App Router pages and API routes.
- `src/lib` — server-side helpers (Prisma client, auth config, session guards).
- `prisma/schema.prisma` — database schema.
- `docs/superpowers/specs/` — design specs.
- `docs/superpowers/plans/` — implementation plans, one per phase.

## Deployment

- `docs/production.md` — deploy to your own VPS (PM2 + Caddy). No request-size or cron
  limits; you own TLS, backups, and monitoring.
- `docs/vercel.md` — deploy to Vercel. Note the ~4.5 MB request body limit (the extension
  AI proxy allows 12 MB). Hobby allows daily crons only, so the `*/5` stuck-job sweep is
  no longer in `vercel.json` — the endpoint still works and needs an external trigger.
