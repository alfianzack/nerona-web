# Email/Password Registration & Auth Page Redesign

Date: 2026-07-14

## Purpose

The Foundation phase shipped Google OAuth as the only sign-in method, with bare, unstyled
pages (plain Tailwind defaults) since that phase was scoped to prove the auth/role-gating
logic worked, not to look finished. This extends that work with:

1. An email/password registration option alongside Google OAuth.
2. Email verification and password reset for the email/password path.
3. A polished, Apple-inspired visual redesign of all auth-related pages.

This is an extension of the Foundation phase design
(`docs/superpowers/specs/2026-07-14-nerona-website-design.md`), not a replacement — Google
OAuth, the `AdminRole`/`getAdminRole` model, and `requireUser`/`requireAdmin` guards are all
unchanged in purpose, only adjusted where the new auth method requires it.

## Key Architectural Change: Session Strategy

next-auth v4's `CredentialsProvider` (needed for email/password sign-in) **does not support**
`session: { strategy: "database" }` — the strategy the Foundation phase used for Google OAuth.
Adding password login requires switching to `session: { strategy: "jwt" }`.

This is a required technical change, not a preference. Consequences:
- The `session` callback in `src/lib/auth.ts` (which currently receives a DB `user` object)
  is replaced by a `jwt` callback (populates `id`/`role` onto the token at sign-in) plus a
  `session` callback that copies fields from `token` onto `session.user`.
- `getAdminRole`, `requireUser`, `requireAdmin`, and every page consuming
  `session.user.id`/`.role` are unaffected — the shape of `session.user` stays the same, only
  where the data comes from changes.
- Google OAuth continues to work exactly the same way from the user's perspective.

## Data Model Changes

- `User` gains `password String?` (nullable — Google-only users never set one).
- Two new tables, kept separate from Auth.js's own `VerificationToken` (which has different
  semantics — it belongs to Auth.js's built-in "Email" magic-link provider, which this project
  doesn't use, and shouldn't be overloaded with unrelated purposes):
  - `EmailVerificationToken` — `id`, `userId`, `token` (unique), `expires`, `createdAt`.
  - `PasswordResetToken` — `id`, `userId`, `token` (unique), `expires`, `createdAt`.

## Registration, Verification & Reset Flow

- **`/register`**: email + password + confirm-password. Submits to `POST /api/register`:
  validates (email format, password ≥ 8 characters server-side, not already registered — a
  duplicate returns a generic "an account with this email may already exist" message, not a
  direct confirmation, to avoid email enumeration), creates the `User` with a
  `bcryptjs`-hashed password, creates an `EmailVerificationToken` (24h expiry), emails a
  verification link via Resend, signs the user in, redirects to `/account`.
- **Unverified users can still sign in and use `/account`** — a persistent banner there prompts
  verification with a "resend email" action. Full sign-in blocking was considered and rejected
  as unnecessary friction for this scope; can be tightened later if needed.
- **`/verify-email?token=...`**: consumes the token, sets `User.emailVerified = now()`, deletes
  the token, redirects to `/account` with a success message. Expired/invalid tokens show an
  error with a "resend" link.
- **`/login`**: email + password fields, plus the existing "Continue with Google" button
  (divider between the two methods). Wrong password and unknown email both show the same
  generic "Invalid email or password" error — no distinction, to avoid leaking which emails are
  registered.
- **`/reset-password`** (request step): email field → `POST /api/forgot-password` → always
  responds "if that email exists, we've sent a reset link" regardless of whether it does
  (same anti-enumeration reasoning) → creates a `PasswordResetToken` (1h expiry), emails a
  reset link via Resend.
- **`/reset-password/[token]`** (confirm step): new password + confirm → `POST
  /api/reset-password` → validates the token isn't expired/used, updates `User.password`,
  deletes the token, redirects to `/login` with a success message.
- **Google account colliding with an existing password account**: `allowDangerousEmailAccountLinking`
  is already enabled on the Google provider (from an earlier fix in the Foundation phase), so a
  user who registered with email/password and later signs in with Google using the same email
  gets the Google account linked to their existing `User` row — same person, two entry points.
  This is intentional, not a bug to guard against.

## Visual Design Direction (Apple-inspired)

- **Typography**: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Inter,
  sans-serif` — renders as San Francisco on Apple devices, a close match elsewhere). Large,
  bold, tight-tracking headings (`text-4xl font-semibold tracking-tight`), muted gray secondary
  text/labels.
- **Palette**: near-monochrome. White background / near-black text in light mode, inverted in
  dark mode (Tailwind `dark:` variants, following system theme). One primary action color:
  solid black (light mode) / white (dark mode) pill buttons — no separate brand color
  competing for attention.
- **Layout**: single centered card (`max-w-sm`, generous padding, rounded-2xl corners, soft
  shadow), vertically centered on the page, wordmark at the top, clear hierarchy (headline →
  subtext → form → footer link).
- **Buttons**: full-width, pill-shaped (`rounded-full`), smooth hover/focus transitions
  (~150ms). "Continue with Google" is an outlined pill with the Google mark; the primary
  email/password action is a solid pill button.
- **Forms**: clean bordered inputs, subtle focus ring, inline error text in red directly under
  the offending field (not a top banner). Success/info states (e.g. "check your email") replace
  the form with a calm centered message, not a toast.
- **Motion**: minimal — fade/slide-in on page load, button press feedback, nothing beyond that.

## Error Handling & Edge Cases

- Duplicate registration, unknown-email login, and non-existent-email password reset all
  return intentionally generic responses (anti-enumeration), per the flow section above.
- Verification and reset tokens are single-use (deleted on success) and time-limited (24h
  verification, 1h reset); expired/used tokens show a clear "this link has expired, request a
  new one" state rather than a raw error.
- Password minimum length (8 characters) is checked both client-side (fast feedback) and
  server-side (authoritative — never trust client-only validation).
- Rate limiting on `/api/register` and `/api/forgot-password` is out of scope for this pass (no
  rate-limiting infrastructure exists yet in the project) — flagged as a follow-up, not
  blocking, given this is a low-traffic pre-launch site.

## Testing Strategy

- Unit tests (Vitest) for the password hashing/verification helper and the token
  generation/validation helpers (expiry checks, single-use consumption) — pure logic, mocked
  DB access, consistent with the Foundation phase's existing test pattern.
- Manual verification (email delivery can't be automated in this environment): register a test
  account, confirm the verification email arrives and its link works, request a password
  reset, confirm that email arrives and its link works, sign in with the new password.
- No automated tests for the styled pages themselves (visual output isn't unit-testable) —
  verified by running the dev server and viewing them, consistent with how the Foundation
  phase's pages were checked.

## Out of Scope (for this spec)

- Rate limiting on auth endpoints.
- Blocking unverified users from full access (only a reminder banner, per the flow section).
- Two-factor authentication.
- Account linking UI (linking happens automatically via matching email, per the Google
  collision behavior above; no user-facing "link accounts" flow).
