# Arah Visual — Design

**Date:** 2026-08-13
**Status:** Approved

## Problem

The owner's report was that nerona-web "terkesan generate AI". An audit of `src/` found that the usual tells are *absent*: there are zero `text-gray-*`, `bg-slate-*`, `indigo-*`, `purple-*`, or `violet-*` classes, no `max-w-7xl mx-auto px-4`, and `tailwind.config.ts` carries a real semantic token layer (`canvas` / `surface` / `ink` / `muted`) derived from the logo.

The problem is monoculture, not taste. Three recipes are stamped across every screen:

1. **One card, 57 occurrences across 41 files.** `rounded-3xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10`, varying only in padding. `DataTable.tsx:56` and `Modal.tsx:39` bake it into the primitives themselves. The `from-surface to-surface2` gradient is white→#F4F8FD — a gradient doing no visual work, applied by reflex.
2. **One button, 43 occurrences across 39 files.** The gold pill. There is no secondary, destructive, or tertiary tier, so "Batal" carries the same visual weight as "Beli poin".
3. **No typographic scale.** 437 of 547 size declarations (79.9%) are `text-sm` or `text-xs`. `text-base` appears three times in the entire app. Marketing jumps from `text-sm` to `text-5xl` with nothing between. The page heading `text-3xl font-semibold tracking-tight text-ink` is copied byte-identically 16 times.

Secondary findings:

- **No primitives exist.** `components/ui/` holds only `DataTable`, `Modal`, and `icons`. There is no `Button`, `Card`, `Badge`, or `Input` — the closest are `AuthButton`/`AuthInput`/`AuthCard`, used only by the auth screens. Every other style is copy-pasted.
- **`globals.css` is three lines** (`@tailwind base/components/utilities`). No custom properties, no base layer, no `:focus-visible`.
- **43 primary buttons have no keyboard focus state.** `focus:` appears in 18 files, all form inputs. Every CTA in the app is keyboard-invisible.
- **The accessible brand orange was re-derived ad hoc four times** under four hexes — `#C25717`, `#E0661C`, `#9A6B08`, `#B45309` — none of them tokens. `Sparkline.tsx:1` documents why (`#FF8B45` fails 3:1 on white) but the fix never got promoted.
- **`CtaLink.tsx:13-14` still uses stock Tailwind blue** (`bg-blue-600`, `text-blue-700`), and its `bg-blue-600 text-ink` pairing is dark-on-dark.
- **Emoji stand in for icons** in the most visible places: homepage product cards (`🖼️`/`💬`), payment methods (`📱`/`🏦`), `FreeActivateCard` (`🎉`) — while a real SVG icon set sits unused in `icons.tsx`.
- **Status colors are ungoverned.** `rose-*` and `emerald-*` appear across 40+ files and drift between the 400/500/600/700/800 steps.

Uniformity is the mechanism. When every surface is the same object, nothing guides the eye, and the result reads as assembled rather than designed.

## Outcome

Two surfaces with different jobs, sharing one design language.

- **Public pages get "Bening"** — the restraint of apple.com, which the owner named as the target. Large tight headings, a genuinely large sub-heading, generous section rhythm, one accent colour, and zero decoration.
- **The application gets "Presisi"** — a tool treatment. Hairline borders instead of shadows, ink-solid primary buttons, monospace numerals, higher density. A dashboard should be read fast.

The two are closer than they first appear: both are flat surfaces separated by hairlines, both carry no shadows, both hold colour back hard. What differs is density and rhythm — which is exactly how Apple itself treats a product page versus an account panel.

Logo colours are unchanged. What changes is how they are used.

### What "like Apple" actually means

Apple licenses SF Pro, which cannot be licensed for the web outside Apple platforms. Its closest available relative is **Inter — already installed in this project**. So the target look is almost entirely *not* the typeface. Seven measured differences carry it, and all seven are reachable without changing a font:

| # | Apple | nerona-web today |
|---|---|---|
| 1 | Never sets gradient text | Gradient headline on 4 pages, with `via-` equal to `to-` |
| 2 | No shadows on cards; surfaces separate by background colour | `shadow-lg` ×60 |
| 3 | Flat single-colour buttons | Gold gradient plus a coloured shadow |
| 4 | Sub-headings run 21–28px | 18–20px — which is why the hero reads small despite a 72px headline |
| 5 | Generous section rhythm, less content per screen | 96px bands, denser content |
| 6 | Two text colours plus one accent | Blue, orange, gold, and emerald in a single hero |
| 7 | Tracking tightens as size grows | One `tracking-tight` everywhere |

A third direction, a fully dark application ("Ruang Kerja"), was designed and deferred. Once the token layer exists, dark mode is a much cheaper follow-up, and it is better done when someone asks for it.

Reviewed as live artifacts before approval:
- Directions and screens — <https://claude.ai/code/artifact/ae3d2cab-692b-4b2f-94f2-ed6232a60fb7> (its "Redaksi" panel is superseded by Bening)
- Typeface rounds — <https://claude.ai/code/artifact/53469455-ff20-4450-b229-ec581b6d7ab5>
- Bening, approved — <https://claude.ai/code/artifact/5cc1742b-3882-4b0d-ae92-2e9ee361787b>

## Decisions

Settled during design. Do not relitigate during implementation.

| Decision | Choice |
|---|---|
| Brand palette | Unchanged. The four logo stops stay exactly as they are. |
| Surface split | Two token sets. App/admin is the `:root` default; marketing overrides via `[data-surface="marketing"]`. |
| Auth screens | Marketing surface. They are reached from the public header and belong to the acquisition funnel. |
| Display face | **None.** Bening needs no third typeface — this was the finding that killed the earlier "Redaksi" serif direction. |
| UI face | **Inter, kept.** It is the closest available relative of SF Pro, it is already installed, and swapping it buys a difference customers would not notice. |
| Data face | **IBM Plex Mono** — numerals, labels, IDs, and the metadata meta lines. The only new font loaded. |
| Marketing accent | **One colour: brand blue.** No gold on public pages except inside the logo itself. Apple's single-accent discipline is most of the effect. |
| Gold gradient | Survives **only inside the app**, marking actions that move money: top-up, checkout, renew. There it earns its weight against many competing actions; on a landing page it does not. |
| Primary button | Driven by an `--action` token: brand blue `#2E52C0` on marketing, ink `#16233D` in the app. One component, both surfaces. |
| Button shape | Marketing CTAs are pills (`980px`), app buttons are `8px`. Deliberate, and Apple's own split between a product page and an account panel. Inputs are never pills — they use `--radius-control`. |
| Secondary action on marketing | A text link with `›`, not a second button. Two competing pills is the pattern being removed. |
| Card elevation | No shadow anywhere on static cards, on either surface. Shadows only for genuinely floating layers — modal, dropdown. |
| Contrast-corrected hexes | Promoted to tokens. `#E0661C` collapses into `--brand-orange-ink` (`#C25717`, darker, so it passes wherever `#E0661C` did); `#B45309` into `--brand-gold-ink`. |
| Tailwind token format | Space-separated RGB channels behind `rgb(var(--x) / <alpha-value>)`, so existing `/10` alpha syntax keeps working. |
| `navy` ramp | Kept. Still needed for the dark marketing band and the `CtaBanner`. It stops being used for borders. |
| Migration safety | Wave 1 only *adds*. Nothing is deleted until Wave 5, so the build stays green at every commit. |
| Emoji | Replaced with SVG icons everywhere they act as UI, including `🎉` — at `text-3xl` it reads as clip-art. |
| Business logic | Untouched. No Prisma migration, no API change, no query change. |
| Metadata prompts | Out of scope entirely. |
| Dark mode | Deferred. The token layer makes it possible; it is not built now. |

## Architecture

### Token layer

`globals.css` grows from three lines to a token sheet. Values are RGB channels so Tailwind's `<alpha-value>` keeps working:

```css
:root {
  /* Brand — the logo's four stops. Unchanged. */
  --brand-sky:    110 201 242;   /* #6EC9F2 */
  --brand-blue:    74 125 232;   /* #4A7DE8 */
  --brand-gold:   255 214  92;   /* #FFD65C */
  --brand-orange: 255 139  69;   /* #FF8B45 */

  /* Contrast-safe variants. These were four hand-written hexes in six files. */
  --brand-sky-ink:     31 127 174;  /* #1F7FAE */
  --brand-blue-ink:    59 101 196;  /* #3B65C4 */
  --brand-orange-ink: 194  87  23;  /* #C25717 */
  --brand-gold-ink:   154 107   8;  /* #9A6B08 */

  /* Surface — Presisi (app + admin default) */
  --canvas:          255 255 255;
  --surface:         255 255 255;
  --surface-sunken:  245 247 250;
  --border:          226 231 238;
  --divider:         237 240 245;
  --ink:              15  23  36;
  --muted:            90 100 115;
  --accent:           59 101 196;  /* = brand-blue-ink */
  --emphasis:        194  87  23;  /* = brand-orange-ink */

  --action:           22  35  61;  /* ink-strong: primary button */
  --on-action:       255 255 255;

  /* Status. One step each — no more drifting between 400 and 800. */
  --success:      4 120  87;   --success-bg: 236 253 245;
  --warning:    180  83   9;   --warning-bg: 255 251 235;
  --danger:     190  18  60;   --danger-bg:  255 241 242;

  --radius-card: 12px;
  --radius-control: 8px;   /* inputs, selects */
  --radius-action: 8px;    /* buttons */
  --radius-chip: 6px;

  --shadow-card: none;
  --shadow-float: 0 8px 24px -8px rgb(15 23 36 / 0.18);

  --band: 72px;            /* vertical rhythm between app sections */
}

/* Bening — public pages and auth */
[data-surface="marketing"] {
  --canvas:          255 255 255;
  --surface:         255 255 255;
  --surface-sunken:  245 247 250;   /* alternating bands and product panels */
  --border:          228 233 240;
  --divider:         237 241 246;
  --ink:              22  35  61;
  --muted:            92 107 133;
  --accent:           46  82 192;
  --action:           46  82 192;

  --radius-card: 14px;
  --radius-control: 10px;
  --radius-action: 980px;  /* the pill is marketing-only */
  --radius-chip: 6px;

  --band: 104px;
}
```

`tailwind.config.ts` maps each token to a utility, keeping every existing class name valid:

```ts
canvas:  "rgb(var(--canvas) / <alpha-value>)",
surface: "rgb(var(--surface) / <alpha-value>)",
ink:     "rgb(var(--ink) / <alpha-value>)",
// …and so on for border, divider, muted, accent, emphasis, action, success, warning, danger
```

`surface2` stays as an alias of `--surface-sunken` through Wave 4, so the 57 existing `from-surface to-surface2` sites keep compiling while they are migrated.

### Where the surface attribute lives

```
src/app/layout.tsx              <body> — no attribute; :root default = Presisi
  (marketing)/layout.tsx        <div data-surface="marketing">
  (auth)/layout.tsx             <div data-surface="marketing">
  (app)/layout.tsx              no attribute — inherits Presisi
  (admin)/layout.tsx            no attribute — inherits Presisi
```

One attribute, set in two places. No JavaScript, no context, no flash — the whole switch is CSS inheritance.

### Typography

Two faces via `next/font/google`, subsetted to latin, exposed as CSS variables on `<html>`:

| Variable | Face | Role |
|---|---|---|
| `--font-sans` | Inter (already loaded) | Everything — headings, UI, body |
| `--font-mono` | IBM Plex Mono, weights 400/500/600 | Numerals, labels, IDs, meta lines |

The scale is where the work is. Added to `tailwind.config.ts` as named sizes, replacing the `text-sm`-for-everything habit. Tracking tightens as size grows — finding #7 above:

| Class | Size / leading / tracking | Surface | Use |
|---|---|---|---|
| `text-display-1` | `clamp(2.375rem, 6.6vw, 5rem)` / 1.04 / -0.024em | marketing | Hero — 38→80px |
| `text-display-2` | `clamp(1.8125rem, 4.6vw, 3.25rem)` / 1.07 / -0.022em | marketing | Band headings — 29→52px |
| `text-lead` | `clamp(1.125rem, 2.2vw, 1.625rem)` / 1.36 / -0.012em | marketing | Sub-heading — 18→26px, the size that is missing today |
| `text-title-1` | 2rem / 1.08 / -0.032em | app | Page `<h1>` |
| `text-title-2` | 1.25rem / 1.25 / -0.015em | both | Card and section headings |
| `text-body-lg` | 1.0625rem / 1.5 / -0.003em | marketing | Marketing body — 17px |
| `text-body` | 0.9375rem / 1.6 | app | App body — the missing middle size |
| `text-caption` | 0.75rem / 1.5 | both | Hints, timestamps |
| `text-label` | 0.6875rem / 1.4 / 0.085em, uppercase | both | Stat labels, table headers, eyebrows — mono |

Headline weight is 600 on both surfaces, never 700 — Apple's headings are semibold, and the current `font-semibold` already matches.

### Primitives

New files in `src/components/ui/`. Each is presentational — no data fetching, no session access.

| Component | API | Notes |
|---|---|---|
| `cn.ts` | `cn(...classes)` | Six lines. No new dependency; `clsx` is not worth adding. |
| `Button.tsx` | `variant: primary \| secondary \| money \| ghost \| danger`, `size: sm \| md`, `loading` | Reads `--action` and `--radius-action`, so it renders a blue pill on marketing and an ink 8px button in the app without a prop. |
| `ButtonLink.tsx` | Same variants, wraps `next/link` | Separate component rather than an `as` prop — keeps both type signatures honest. |
| `TextLink.tsx` | `href`, children | The marketing secondary action: accent colour plus a trailing `›`. |
| `Card.tsx` | `variant: default \| sunken \| flush`, `padding: sm \| md \| lg` | Replaces the 57-site recipe. |
| `Badge.tsx` | `tone: neutral \| info \| success \| warning \| danger \| points` | Replaces the ad-hoc chip map at `admin/page.tsx:11-14`. |
| `Input.tsx` | Native props + `invalid` | Uses `--radius-control`; never a pill. |
| `Field.tsx` | `label`, `hint`, `error`, children | Wraps `Input`; owns the label/error markup `AuthInput` currently hardcodes. |
| `Stat.tsx` | `label`, `value`, `hint` | Mono numerals, `tabular-nums`. |
| `PageHeader.tsx` | `title`, `description`, `actions` | Replaces the 16 identical `<h1>` lines. |
| `Band.tsx` | `tone: plain \| sunken \| navy`, `align: left \| center` | Marketing section wrapper; owns the `--band` rhythm and the `980px` max-width container. |

`AuthButton`, `AuthInput`, and `AuthCard` are re-implemented as thin wrappers over `Button`, `Field`, and `Card` so the four auth pages need no edits in Wave 1, then are deleted in Wave 5 once their call sites move.

### Base layer

`globals.css` gains an `@layer base` that fixes what is currently missing app-wide:

```css
@layer base {
  :focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }
  ::selection { background: rgb(var(--brand-sky) / 0.28); }
  [type="number"] { font-variant-numeric: tabular-nums; }
}
```

The `:focus-visible` rule alone resolves the 43 keyboard-invisible buttons.

## Waves

Each wave is a commit that builds and passes tests on its own.

**Wave 1 — Foundation.** `globals.css`, `tailwind.config.ts`, `layout.tsx` (add IBM Plex Mono), the eleven primitives, `cn.ts`. Adds only; changes no existing screen. Roughly 14 files.

**Wave 2 — Public pages and auth.** `Hero`, `FeatureSection`, `ContributorPainSection`, `StepsSection`, `PricingTiers`, `FaqSection`, `CtaBanner`, `MarketplaceRow`, `MarketingHeader`, `MarketingNavLinks`, `Footer`, `CtaLink`, `HomeMetadataOnly`, `HomeMultiProduct`, `ProductCards`, `pricing/page`, the four auth pages and their three components. Roughly 26 files. This is where the seven Apple findings land.

**Wave 3 — Tenant app.** `AppShell`, `AppSidebar`, `AccountMenu`, `icons.tsx` (new glyphs for the retired emoji), `dashboard`, `finance`, `riwayat-metadata`, `unduh` + `ExtensionConnectPanel`, `paket`, `order`, `order/[id]`, `profile` + forms, `hubungkan`, metadata log components, top-up and checkout components. Roughly 28 files.

**Wave 4 — Admin.** `admin/page`, `AdminUsersDirectory`, `AdminOrdersPanel`, `UserDetailTabs`, `UserFinancePanel`, `UserPlanManager`, the six settings panels, `Sparkline`, `DataTable`, `Modal`, `admin/metadata`. Roughly 17 files.

**Wave 5 — Cleanup.** Delete `AuthButton`/`AuthInput`/`AuthCard`, drop the `surface2` alias, remove now-unused `gold`/`navy` steps, and grep for surviving copies of the three recipes.

Dead-by-default screens (`/agent/*`, `/produk`, `/transaksi`, `HomeMultiProduct`) are migrated to the tokens so they do not break when `AGENT_ENABLED` is turned back on, but are not redesigned.

## What is preserved

These got real attention and must not be flattened:

- **`components/marketing/mockups/`** — six bespoke product illustrations. `MetadataCardMockup` in particular carries a choreographed reveal via the three custom keyframes in `tailwind.config.ts:18-38`, and its `motion-reduce` handling is genuinely careful: the hidden state lives in the keyframe's `from`, not in markup, so `motion-reduce:animate-none` yields a complete card instead of an invisible one. Tokens change; structure and animation do not.
- **`ContributorPainSection.tsx`** — already the only section with a real type scale, and its docblock explicitly refuses invented statistics.
- **`Sparkline.tsx`** — hand-built server-rendered SVG with `vectorEffect="non-scaling-stroke"` and proper `role="img"`. Kept; only its colours move from per-call hex props to tokens.
- **`AppShell`'s three-breakpoint sidebar** — drawer below `sm`, 56px strip to `xl`, labelled rail above. Chosen in CSS rather than JS to avoid a hydration flash. The mechanism stays.
- **`StepsSection.tsx`** — per-step accents and `text-balance`.

## Verification

The test suite cannot catch visual regressions here: all 97 test files live in `tests/lib/` and exercise logic only — none renders a component or asserts on a class name. Verification is therefore build correctness plus manual passes.

1. `npm run build` passes, and `npm test` stays green after every wave.
2. `npm run dev`, then walk every live route at three widths — below 640, 640–1280, above 1280 — matching the three sidebar modes.
3. Tab through each page with the keyboard alone. Every button, link, and input must show a visible focus ring. This is the check the current code fails.
4. Verify text contrast on the accent, the gold money buttons, and the navy bands. This is precisely the problem previously solved four times with four different hexes.
5. Confirm `AGENT_ENABLED = true` still renders the hidden screens without error.
6. Confirm `prefers-reduced-motion` still yields a complete `MetadataCardMockup`.
