# Full Redesign: Indonesian-Language Site + Admin-Managed Pricing

Date: 2026-07-17

## Purpose

The current site works functionally (auth, license grants, courses, admin panel all verified)
but the visual design is unpolished and the copy is in English while the actual customer base is
Indonesian. This phase is a full front-end redesign — every customer-facing and admin page —
with three goals:

1. **Fully Indonesian** — every string a visitor or admin sees is Bahasa Indonesia. No language
   toggle; Indonesian is the only language.
2. **Admin-managed pricing** — plan prices and course prices become editable from `/admin`,
   not hardcoded in the seed script. Prices display on `/pricing` and `/learn` exactly as the
   admin typed them.
3. **Visual redesign** — a cohesive, modern design system across every page, replacing the
   current mixed-quality pages.

Functionality does not regress: everything that works today (Google + email/password auth,
email verification, password reset, license/enrollment grants, lesson player with progress,
role-gated admin) still works identically after this phase.

## Explicitly out of scope

- Payment processor integration (still off-platform; admin grants remain the only access path).
- Multi-language support / language switcher — Indonesian only, hardcoded strings, no i18n
  library (YAGNI; a library adds indirection for a single locale).
- Changing tier structure or gating logic — still Starter / Pro / Business with the same
  marketplaces + rejectAnalyzer levers.
- Editing plan/course *structure* from admin (tier names, marketplace sets, course content) —
  only the **price label** is admin-editable this phase. Structure stays seed-managed.
- Email template redesign (verification/reset emails keep current content; translating them is
  a fast follow, noted as a follow-up, not part of this phase's scope).
- Custom fonts/illustrations/photography — the redesign works within Tailwind + the existing
  Inter font; mockup components are refreshed but stay as styled-div mockups.

## Data Model Changes

None required — `Plan.priceLabel` and `Course.priceLabel` already exist and are freeform
strings, which is exactly what "price I can manage" needs (admin types `"Rp 149.000/bulan"` or
anything else; the site renders it verbatim).

Seed changes only:
- Plan seed rows get Indonesian placeholder labels (`"Rp 49.000/bulan"` Starter,
  `"Rp 99.000/bulan"` Pro, `"Rp 199.000/bulan"` Business — placeholders; the admin overwrites
  them from the panel).
- Course seed rows get `"Rp 99.000"` (tutorial) / `"Rp 249.000"` (class) placeholders.
- Course titles/descriptions in the seed switch to Indonesian.
- **Seed must not clobber admin edits**: plan/course upserts stop overwriting `priceLabel` on
  update — they set it only on create. (Today's seed overwrites `priceLabel` every run, which
  would silently revert admin-managed prices.)
- `Order.currency` default changes from `"usd"` to `"idr"` (schema default + the admin grant
  lib's fallback).

## New Feature: Admin Price Management

### API

- `GET /api/admin/pricing` — returns all Plans (id, name, priceLabel, marketplaces,
  rejectAnalyzer) and all Courses (id, slug, title, priceLabel). Admin-gated like the existing
  admin routes.
- `PATCH /api/admin/pricing` — body `{ type: "plan" | "course", id, priceLabel }`. Updates the
  one field. Empty string is allowed and stored as null (renders as "Hubungi kami" fallback).

### Lib

- `src/lib/admin-pricing.ts` — `updatePlanPrice(planId, priceLabel)` /
  `updateCoursePrice(courseId, priceLabel)`, returning the same `{ok}`-result shape as
  `admin-grants.ts`. Unit-tested.

### UI

- `/admin` gains a second panel, **"Harga"** (above or below the existing user panel): two
  small tables — Paket (plan name → editable price input → Simpan button) and Kelas (course
  title → editable price input → Simpan button). Client component `AdminPricingPanel`,
  same fetch conventions as `AdminUserPanel`.

## Redesign — Page by Page

Design system: white/near-black neutral base (keeps current Tailwind gray scale + dark mode),
one accent color (blue-600 family) used for primary CTAs and highlights — the current site has
no accent at all, which is a big part of why it reads flat. Rounded-2xl cards, consistent
spacing scale, `max-w-6xl` content column. All pages share Header/Footer as today.

- **Header/Footer**: nav becomes Harga / Belajar / Masuk (+ Akun / Admin / Keluar when signed
  in). Footer: Indonesian tagline + © line.
- **Homepage `/`**: same section skeleton (Hero → 4 feature blocks → marketplace row → pricing
  teaser) with all copy rewritten in Indonesian and refreshed mockup styling. Hero headline:
  "Metadata untuk kontributor stock, ditulis otomatis." CTA: "Lihat Harga". Marketplace row
  lists all 8 real marketplaces (currently only shows 4).
- **`/pricing` → copy "Harga"** (route stays `/pricing`): 3-card tier grid, middle card (Pro)
  visually featured ("Paling populer" badge, accent border). Each card: name, priceLabel,
  per-tier feature checklist in Indonesian (marketplace coverage from `describeMarketplaces`
  translated, reject analyzer line for Business). Below the grid: a short "Cara berlangganan"
  note explaining payment is arranged via contact + admin activation.
- **`/learn`**: keeps the marketplace-style card grid from the last change; copy in Indonesian
  ("Belajar", deskripsi kelas); priceLabel already shows — stays.
- **`/learn/[slug]`**: Indonesian copy; not-enrolled state shows priceLabel + a short "Hubungi
  kami untuk mendaftar" line; enrolled state (modules/lessons/player) restyled to match the
  design system. "✓ Completed" → "✓ Selesai".
- **Auth pages `/login`, `/register`, `/reset-password*`, `/verify-email`**: same AuthCard
  layout, all labels/errors/buttons in Indonesian ("Masuk", "Daftar", "Lupa kata sandi?",
  "Kata sandi", validation messages, etc.). Client-side validation strings included.
- **`/account` → "Akun"**: restyled license card (status badges with color: aktif hijau,
  dicabut merah), Indonesian labels, email-verification banner in Indonesian.
- **`/admin`**: Indonesian labels throughout both panels ("Cari pengguna", "Berikan", "Cabut",
  "Catatan", "Jumlah", plan picker, "Harga" panel).
- **API error messages** returned to the browser (register/login/reset flows, admin routes)
  translated to Indonesian, since they render in the UI. Server-side console logs stay English.

## String conventions

- Currency: admin types the full display string; no formatting/parsing on our side.
- The `Order.amountCents`-style admin inputs stay numeric; the admin panel labels them
  "Jumlah (Rp)" and the value is stored as-is in `amount` with `currency: "idr"` (we treat
  `amount` as whole rupiah, not cents — rupiah has no cent subdivision in practice; rename the
  API field from `amountCents` to `amount` to stop lying).

## Testing

- `tests/lib/admin-pricing.test.ts` — update happy path, unknown id, empty-string→null.
- Existing test suites must stay green; tests asserting English UI strings (if any assert copy)
  updated to Indonesian.
- Verification pass: `tsc`, full vitest, `npm run build`, seed run, live curl sweep of every
  page confirming Indonesian copy renders and no English strings remain on customer pages.

## Rollout

No schema migration (except the `Order.currency` default change — one tiny migration). Seed
re-run required once. Nothing live yet, so no data/backfill concerns.
