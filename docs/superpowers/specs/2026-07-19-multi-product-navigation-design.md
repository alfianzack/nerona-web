# Multi-Product Navigation & Home Page

Date: 2026-07-19

## Purpose

The site's homepage (`/`) is currently the Metadata Chrome extension's marketing page, and
the top nav only knows about that one product (Harga, Belajar, Akun/Masuk). Nerona now has a
second product, the WhatsApp AI business assistant (see
`docs/superpowers/specs/2026-07-19-nerona-agent-design.md`), which needs its own public
marketing page. This phase turns the site into a proper multi-product hub: a new brand-level
Home page that introduces both products, a dedicated Metadata page carrying today's homepage
content unchanged, a new informational Agent page, and a nav that reflects all of this.

## Explicitly out of scope

- Any change to `/pricing`'s content or checkout flow — it keeps working exactly as today,
  just stops being a standalone top-nav item (it's linked from the Metadata page's own CTAs
  instead).
- A signup/CTA button on the Agent marketing page — Nerona Agent has no self-serve billing
  yet (Phase 1 is manual admin activation only), so the page is informational only.
- Any change to `/learn`'s own content — only its nav label changes (Belajar → Learn).
- Any change to the Nerona Agent product itself (schema, webhook, dashboard logic) beyond
  moving its dashboard route, described below.

## Route Changes

| Route | Before | After |
| --- | --- | --- |
| `/` | Metadata homepage (Hero, 3× FeatureSection, MarketplaceRow, PricingTeaser) | **New** brand-level Home page (see below) |
| `/metadata` | *(did not exist)* | **New.** Today's entire `/` content, moved verbatim — same components, same copy, unchanged. |
| `/agent` | Owner dashboard (phone-linking UI, requires sign-in) | **New public marketing page** for Nerona Agent, no auth required |
| `/agent/dashboard` | *(did not exist)* | The owner dashboard that used to live at `/agent` moves here unchanged, still gated by `requireUser()` |
| `/pricing` | Metadata pricing/checkout | Unchanged — no longer linked from the top nav, only from the Metadata page |
| `/learn` | Learn/courses | Unchanged |

**Route-conflict fix:** Phase 1 of Nerona Agent built `/agent` as the signed-in owner's
phone-linking dashboard. Since the new nav needs a public "Agent" tab at that same path, the
existing dashboard page moves to `/agent/dashboard`. One reference needs updating for this:
`src/lib/agent/webhook-handler.ts`'s unknown-sender reply currently links to `${baseUrl()}/agent`
— it must point to `${baseUrl()}/agent/dashboard` instead, since that's where signing in and
linking a phone number actually happens.

## Home Page (`/`)

Follows the same structural pattern as today's homepage — a Hero section followed by
alternating `FeatureSection` blocks — but repurposed to introduce the company/brand rather
than one product:

- **Hero**: a Nerona-brand tagline (not Metadata-specific), e.g. "Satu perusahaan, alat AI
  untuk kontributor dan pemilik bisnis." No single product mockup (there are two products
  now); instead two CTA buttons: "Lihat Metadata" → `/metadata` and "Lihat Agent" → `/agent`.
- **Metadata section** (`FeatureSection`, theme `dark`): reuses the existing
  `MetadataCardMockup` and the existing Metadata pitch copy, CTA → `/metadata`.
- **Agent section** (`FeatureSection`, theme `light`): new copy introducing the WhatsApp AI
  business assistant (notes, memory, chat), using a **new** `AgentChatMockup` component (a
  WhatsApp-chat-bubble-style mock showing a short sample owner↔agent exchange, visually in the
  same family as `MetadataCardMockup` — rounded card, shadow, ring — but styled as chat
  bubbles instead of a metadata card). CTA → `/agent`.
- No `PricingTeaser` or `MarketplaceRow` on Home — both are Metadata-specific and stay on
  `/metadata`.

Body copy stays Indonesian, matching the rest of the site's existing voice and content — only
the top-nav labels are in English per the approved design (see Nav section). This is an
intentional, approved inconsistency between nav language and body copy language, not an
oversight.

## Metadata Page (`/metadata`)

A pure move: create `src/app/metadata/page.tsx` with exactly the JSX currently in
`src/app/page.tsx` (`Hero`, three `FeatureSection`s, `MarketplaceRow`, `PricingTeaser`), then
replace `src/app/page.tsx` with the new Home page content. No component changes, no copy
changes — this page must render identically to today's homepage.

## Agent Page (`/agent`)

Same visual pattern as `/metadata` for consistency, but shorter and with no pricing/signup
push:

- A lighter Hero-style intro: product tagline for Nerona Agent, no "Lihat Harga" button (no
  pricing exists yet). Reuses the new `AgentChatMockup` from the Home page.
- Two to three `FeatureSection` blocks (alternating theme, matching the existing pattern):
  1. Chat langsung di WhatsApp — satu nomor Nerona, terhubung ke nomor WhatsApp pemilik bisnis.
  2. Agent mengingat percakapan dan catatan bisnis Anda (memory/notes, auto-learned facts).
  3. Optional roadmap teaser: produk, pesanan, dan sinkronisasi kalender menyusul di fase
     berikutnya.
- No `PricingTeaser`. Closing line instead of a sales CTA: "Sudah pelanggan? Masuk ke akun
  Anda" linking to `/login`.

## Nav & Footer

**`Header.tsx`**: nav links become, in order: Home (`/`) · Agent (`/agent`) · Metadata
(`/metadata`) · Learn (`/learn`), followed by the existing session-aware block — signed out
shows a "Sign In" button (`/login`, relabeled from "Masuk"); signed in shows Account (`/account`,
relabeled from "Akun"), Admin (`/admin`, if `session.user.role`, unchanged), and Sign Out
(unchanged behavior, relabeled from "Keluar" — label only, still hits
`/api/auth/signout`). The standalone Harga link is removed.

**`Footer.tsx`**: same link set as the new nav — Home, Agent, Metadata, Learn, Sign In —
replacing the current Harga/Belajar/Masuk set, for consistency between header and footer.

## Testing / Verification

No new lib logic is introduced by this phase — it's routing plus presentational marketing
components, matching the existing convention where marketing components (`Hero`,
`FeatureSection`, `MarketplaceRow`, mockups) have no unit tests today. Verification is:

- `npx tsc --noEmit` and `npm run build` both succeed, with `/`, `/metadata`, `/agent`, and
  `/agent/dashboard` all present in the route manifest.
- Manual click-through in a running dev server: all 5 nav tabs render the right page; all
  footer links match; visiting `/agent/dashboard` while signed out redirects to `/login`
  (unchanged behavior, just at the new path); the webhook's unknown-sender reply text is
  updated (verified by reading the source, not by sending a real WhatsApp message).
