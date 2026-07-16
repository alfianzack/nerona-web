# Marketing Homepage Redesign

Date: 2026-07-16

## Purpose

The homepage (`src/app/page.tsx`) currently just shows the app name and a sign-in/account
status link — it does nothing to sell the product. This project turns it into a real
marketing page for **Nerona Metadata**: a Chrome extension that uses AI to generate metadata
(title, description, up to 30 keywords) for stock-photo/video contributors and applies it
directly into the upload forms of Adobe Stock, Freepik, Vecteezy, and Shutterstock (per
`nerona_medata/README.md`). The goal is to drive visitors straight into the existing Stripe
checkout flow at `/pricing`.

No image/screenshot assets exist in the repo yet (no `public/` folder), so all product
visuals are CSS/SVG mockups built in code, not real screenshots.

## Approach

Single long-scroll page in an Apple-style layout: a dark full-bleed hero, then alternating
light/dark sections each making one claim with a small mockup, a plain-text marketplace row,
a copy-only pricing teaser linking to `/pricing`, and a footer. A new shared header/nav
(logo, Pricing link, Sign in/Account) is added at the root layout level so it's consistent
across the whole site, not just the homepage.

This was chosen over (a) a compact SaaS grid-plus-embedded-pricing-table layout, and (b) an
interactive per-marketplace tab switcher — both considered and rejected in favor of matching
"Apple.com" long-scroll storytelling; the tab-switcher idea can be added later as one section
inside this structure if wanted, without restructuring the page.

## Page Structure & Copy

In order, top to bottom:

1. **Header** (dark-on-light, sticky) — "Nerona" wordmark, "Pricing" link, "Sign in" (signed
   out) or "Account" + sign-out (signed in).
2. **Hero** (dark bg) — Headline: "Metadata for stock contributors, written for you." /
   Subhead: "Nerona generates titles, descriptions, and keywords with AI, then fills them
   straight into your upload forms." CTA: **Get Nerona** → `/pricing`.
3. **Feature 1** (light bg, mockup on the right) — "Write once, skip the typing." AI drafts a
   title, description, and 30 keywords per image.
4. **Feature 2** (dark bg, mockup on the left) — "One click. Every marketplace." Works
   directly on Adobe Stock, Freepik, Vecteezy, and Shutterstock's own upload forms — no
   copy-paste.
5. **Feature 3** (light bg, mockup on the right) — "Keywords that keep pace." 30 AI-generated
   keywords plus room for custom ones, kept consistent across every upload.
6. **Feature 4** (dark bg, mockup on the left) — "Built for batches." Pick multiple images,
   watch progress per image, apply across every open marketplace tab at once.
7. **Marketplace row** (light gray bg) — plain-text wordmarks: Adobe Stock, Freepik, Vecteezy,
   Shutterstock. Text only — no logo image assets, to stay clear of trademark/logo-asset
   issues.
8. **Pricing teaser** (light bg, centered) — "One plan. Every marketplace." + one line of
   copy + **See pricing** button → `/pricing`. No price digits and no DB/Prisma query here —
   `/pricing` already owns the live Plan/Stripe lookup (`src/lib/checkout.ts`); duplicating it
   here would create a second source of truth, and would be broken today anyway since
   `STRIPE_PRICE_ID_MONTHLY`/`YEARLY` are still unset (see
   `docs/superpowers/plans/2026-07-15-checkout-license-issuance.md`, paused at Task 15).
9. **Footer** (light bg) — wordmark, © year, Pricing / Sign in links.

Out of scope for this page: any "install the extension" instructions or download link — the
extension isn't published anywhere public yet (`nerona_medata/README.md` only documents
"Load unpacked" dev-mode install). Post-purchase extension delivery is handled outside the
homepage for now.

## Components & Architecture

New, reusable across the whole site:

- `src/components/layout/Header.tsx` — async server component; calls `getServerSession(authOptions)`
  itself (same pattern `src/app/page.tsx` uses today) to decide Sign in vs. Account+sign-out.
  Sticky, minimal.
- `src/components/layout/Footer.tsx` — static, no props.
- `src/app/layout.tsx` — wraps `{children}` with `<Header />` and `<Footer />`; adds
  `next/font`'s Inter as the site sans font (closest ship-today analog to Apple's SF Pro; no
  other font is currently loaded). `metadata` (title/description) stays as-is.

New, homepage-specific, under `src/components/marketing/`:

- `Hero.tsx` — headline, subhead, CTA link.
- `FeatureSection.tsx` — generic props (`eyebrow?`, `title`, `body`, `mockup: ReactNode`,
  `theme: "light" | "dark"`, `imageSide: "left" | "right"`); reused for all four feature
  blocks so the four sections share one implementation instead of four near-duplicates.
- `mockups/` — small presentational, CSS-only components with no logic:
  `MetadataCardMockup`, `MarketplaceTabsMockup`, `KeywordChipsMockup`, `BatchProgressMockup`.
- `MarketplaceRow.tsx` — the plain-text wordmark row.
- `PricingTeaser.tsx` — copy + CTA link to `/pricing`. No data fetching.
- `CtaLink.tsx` — a small `next/link`-based pill button matching `AuthButton`'s existing
  visual style (rounded-full, primary black/white, secondary outline) so marketing CTAs look
  consistent with the auth pages, without modifying `AuthButton` itself (auth flows keep
  using `AuthButton` exactly as-is).

`src/app/page.tsx` becomes a server component that just assembles `Hero`, four
`FeatureSection`s, `MarketplaceRow`, and `PricingTeaser` in order — the signed-in/signed-out
branching that lives there today moves into `Header`.

No changes to `tailwind.config.ts` beyond registering the Inter font variable in
`theme.extend.fontFamily.sans` — the monochrome look comes from Tailwind's default
black/white/gray palette, matching the existing blue-600 link color already used elsewhere
in the app.

## Data Flow

No new API routes, no new Prisma queries, no new environment variables. The only existing
data dependency this page touches is `getServerSession` (already used by `page.tsx` today,
moving into `Header`). All pricing/checkout logic continues to live entirely in
`/pricing` + `src/lib/checkout.ts`, untouched by this change.

## Testing / Verification

This page is static marketing copy plus one session branch — consistent with this codebase's
existing pattern of not unit-testing static or session-branching pages (auth/account pages
aren't unit tested either; only `lib` logic and API routes are, per
`.superpowers/sdd/progress.md`). Verification is manual:

1. `npm run build` (or `tsc --noEmit`) — confirm the new components and Inter font import
   compile cleanly.
2. `npm run dev` — load `/` signed out: confirm Header shows "Sign in", every CTA
   (`Get Nerona`, `See pricing`) lands on `/pricing`.
3. Sign in, reload `/`: confirm Header shows "Account" + sign-out, rest of the page unchanged.
4. Resize to a mobile width: confirm `FeatureSection` stacks (mockup below text) instead of
   side-by-side.
5. Spot-check `/pricing`, `/login`, `/account` still render correctly with the new shared
   Header/Footer wrapping them.

## Out of Scope

- Real product screenshots (CSS/SVG mockups only, for now).
- Any extension download/install section (extension isn't publicly distributed yet).
- Embedding a full pricing table or live price digits on the homepage (stays on `/pricing`).
- Marketplace logo image assets (text wordmarks only).
