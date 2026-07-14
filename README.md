# Nerona Website

Order and license maintenance platform for the Nerona Metadata Chrome extension.

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — Postgres connection string (e.g. from https://neon.tech).
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev.
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from an OAuth 2.0 Client ID at
     https://console.cloud.google.com/apis/credentials (type "Web application"), with
     `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
   - `OWNER_ADMIN_EMAIL` — the Google account email that should get full admin access.
2. Install dependencies: `npm install`
3. Apply the database schema: `npm run prisma:migrate`
4. Start the dev server: `npm run dev`, and sign in with Google using the email you set as
   `OWNER_ADMIN_EMAIL` (this creates your `User` + linked `Account` row)
5. Grant yourself admin access: `npm run prisma:seed`

Note: Prisma CLI commands always go through the `npm run prisma:*` scripts (not raw
`npx prisma ...`) because those scripts load secrets from `.env.local` via `dotenv-cli` — the
Prisma CLI itself only auto-loads a plain `.env` file.

## Testing

Run `npm test` for the unit test suite (session/role-guard logic). Payment and OAuth flows are
verified manually against Stripe/Google test modes — see later phase plans.

## Project structure

- `src/app` — Next.js App Router pages and API routes.
- `src/lib` — server-side helpers (Prisma client, auth config, session guards).
- `prisma/schema.prisma` — database schema.
- `docs/superpowers/specs/` — design specs.
- `docs/superpowers/plans/` — implementation plans, one per phase.
