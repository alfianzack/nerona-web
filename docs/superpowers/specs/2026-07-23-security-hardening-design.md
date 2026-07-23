# Nerona-web Security Hardening — Design

**Date:** 2026-07-23
**Scope:** nerona-web only (browser extension excluded). App is not yet deployed.

## Goal

Close the "front door" gaps in an app whose code-level security is already solid
(bcrypt passwords, per-route authorization, Prisma-only DB access, no XSS sinks,
clean secrets). Five essential fixes, no new services, no DB migration.

## 1. Rate limiting

**Problem:** No throttling on login, register, forgot/reset password, or
resend-verification. Enables brute-force, credential stuffing, email-bombing.

**Approach:** A small in-memory fixed-window limiter in `src/lib/rate-limit.ts`
keyed by client IP (+ endpoint). Applied in each auth route handler and in the
NextAuth `authorize` callback. Returns HTTP 429 with a friendly Indonesian message.

- register / forgot / reset / resend: 5 requests per 10 minutes per IP.
- login (credentials): 10 attempts per 10 minutes per IP.

**Not-deployed-yet note:** In-memory state resets per process and is per-instance.
Documented in the file: when moving to multi-instance/serverless, swap the store
for Upstash Redis (`@upstash/ratelimit`). The public interface stays the same.

## 2. Security headers + CSP

**Problem:** No CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, or Permissions-Policy anywhere.

**Approach:**
- Static headers (`HSTS`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options: DENY`) via `next.config.mjs` `headers()`.
- Content-Security-Policy generated per-request in `src/middleware.ts` with a
  random nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'`). Next.js reads the
  nonce from the CSP header and applies it to its own scripts.
- Allowlist third parties actually used: `frame-src https://player.vimeo.com`,
  `img-src` incl. `https://i.vimeocdn.com` + `data: blob:`, `connect-src` incl.
  Vimeo. `style-src 'self' 'unsafe-inline'` (Tailwind/recharts inline styles).
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `object-src 'none'`.
- Development relaxations (`'unsafe-eval'`, `ws:`) applied only when
  `NODE_ENV !== 'production'` so HMR / React Refresh keep working.

## 3. Middleware guarding admin routes

**Problem:** Authorization is per-route only; a future route that forgets its
check is silently public.

**Approach:** `src/middleware.ts` uses `next-auth/jwt` `getToken` to require a
valid session with a non-null `role` for `/admin/:path*` and `/api/admin/:path*`.
Unauthenticated → redirect to `/login` (pages) or 401 JSON (api). Same file emits
the CSP nonce (item 2). This is defense-in-depth; per-route checks stay in place.

## 4. Google account-linking takeover

**Problem:** `allowDangerousEmailAccountLinking: true` lets a Google sign-in take
over an existing password account with the same email without proving control.

**Approach:** Remove the flag (default `false`). Existing password users keep
their credentials login; Google users link only through the safe default flow.

## 5. Small fixes

- **Webhook verify token:** `handleWebhookVerification` compares the Meta verify
  token with `===`. Replace with a constant-time compare helper.
- **Image proof MIME:** upload trusts client `file.type`. Add magic-byte
  sniffing (PNG/JPEG/WEBP signatures) in `attachPaymentProof`; reject on mismatch.
  Serve responses already get `nosniff` globally; keep `no-store`.

## Testing

- Unit tests (vitest) for the rate limiter (window, reset, per-key isolation) and
  the image magic-byte validator (accept valid signatures, reject spoofed type).
- `npm run build` must pass to confirm middleware/CSP/config compile.

## Out of scope

RBAC split (owner_admin vs support), refresh-token encryption at rest — deferred.
