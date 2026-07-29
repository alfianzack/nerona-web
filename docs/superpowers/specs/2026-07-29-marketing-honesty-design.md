# Marketing Honesty Pass

**Date:** 2026-07-29
**Status:** Approved

## Problem

The marketing pages claim things the system does not do, and one of them is the kind of claim a customer would ask for a refund over.

**The agent does not serve your customers.** `(marketing)/page.tsx` says the agent chats on WhatsApp *"untuk Anda maupun pelanggan Anda"* — for you as well as your customers — and `(marketing)/agent/page.tsx` says it helps *"menjawab pelanggan"*. Neither is true. `lib/agent/webhook-handler.ts:68` tells any unregistered number to go register first, so only the tenant's own number is served. And every tool the agent has is an owner operation: `add_product`, `record_sale`, `update_order_status`, `get_sales_summary`. It is the owner's assistant, not a customer-facing chatbot. Someone who signs up expecting the latter has been misled.

**"Tanpa instalasi rumit"** sits on the landing page while the metadata product requires loading an unpacked extension through Chrome's developer mode (`nerona_medata/README.md:40`). That is a complicated install by any reading.

**The Free framing predates the new figures.** The landing page promises *"rasakan dulu manfaatnya, upgrade hanya kalau memang butuh"* and `/agent` promises *"Mulai gratis, upgrade saat chat Anda makin ramai."* Free is now 10 points for metadata and 15 for agent, once per account, ever (`1bd2174`). Nothing grows, and there is no leisurely evaluation period.

**Design Bundles is claimed but unproven.** It sits in `lib/marketplaces.ts` and therefore in every "all marketplaces" line, while `nerona_medata/QA_CHECKLIST.md` lists it under "HIGH PRIORITY, likely broken".

## Outcome

Every claim on `/`, `/agent`, `/metadata`, and `/pricing` is either verified or gone.

## Decisions

| Decision | Choice |
|---|---|
| Agent positioning | The owner's own assistant. All customer-chatbot phrasing removed. |
| Marketplaces claimed | Seven. Design Bundles excluded until its QA passes. |
| Point allowances in copy | State points, never generate counts |
| `DEFAULT_AI_PRICING` | Realigned to the rates actually in use |
| Marketplace key mismatch | Fixed here — it lives in the same file |

## Why copy must not state generate counts

A point allowance is a fact. "How many images that buys" is derived from admin-editable rates and from token sizes nobody controls, and the spread is not marginal:

| Pricing config | Cost per generate | What 10 Free points buys |
|---|---|---|
| `DEFAULT_AI_PRICING` (0.075 / 0.3 / 100,000) | 24 points | **0 generates** |
| Rates actually stored today (0.25 / 1.5 / 1,000) | 1 point | 10 generates |

Twenty-four times apart, decided entirely by three fields in Pengaturan. Any page that promises a number of images is one admin edit away from lying, so the pages state the allowance and explain what a point is.

**This also exposes a live landmine.** `AdminAiSettingsPanel` explicitly invites *"Kosongkan untuk pakai default"*. Clear those fields today and `DEFAULT_AI_PRICING` takes over, at which point Free buys nothing and Pro's 500 points buys twenty generates. The defaults were calibrated when allowances were 5,000 and 15,000; the revision to 500 and 1,000 left them 24× out of step. **`DEFAULT_AI_PRICING` is therefore realigned to `0.25 / 1.5 / 1_000` as part of this change** — not cosmetic, it stops a documented UI affordance from silently disabling every plan.

## Architecture

### `lib/marketplaces.ts` — one list was doing two jobs

The list is both the functional registry (valid keys for `Plan.marketplaces`, which the extension matches against) and the marketing claim. Those have diverged: eight adapters exist, seven are proven.

```ts
/**
 * Every marketplace with an adapter. Keys MUST match the extension's own
 * ALL_MARKETPLACES (access/access.js) and marketplace-resolve.js — a plan
 * storing a key the extension does not recognise silently denies access to a
 * marketplace the plan grants.
 */
export const MARKETPLACES = [ /* 8 entries, each with claimable: boolean */ ];

/**
 * The only marketplaces marketing may name. Design Bundles is excluded while
 * QA_CHECKLIST.md flags it as likely broken; re-including it is a one-word
 * change once it passes.
 */
export const CLAIMABLE_MARKETPLACES = MARKETPLACES.filter((m) => m.claimable);
```

`MarketplaceRow` and `describeMarketplaces` both switch to `CLAIMABLE_MARKETPLACES`, so `"*"` describes as "Semua 7 marketplace". That **under-claims** — a `"*"` plan functionally reaches eight — and under-claiming is the correct direction to be wrong in.

**The key mismatch is fixed here too.** Web stores `designbundles`; the extension resolves `designbundle` (`marketplace-resolve.js:58`, `access.js:17`). Harmless today because the seeded plans are only `"adobe"` and `"*"`, but the moment an admin restricts a plan by picking from the web's list, the extension rejects a marketplace the plan grants. Same file, so it goes in the same change.

### Copy changes

**`(marketing)/page.tsx`** — the agent card drops *"untuk Anda maupun pelanggan Anda"* for wording that says whose assistant it is. *"Tanpa instalasi rumit"* goes; the three-step section names the actual extension install instead of implying there is nothing to do. The closing CTA states the trial as **points**, once.

**`(marketing)/agent/page.tsx`** — the hero drops *"menjawab pelanggan"*. The pricing subheading stops implying Free scales. The feature list may claim only what has a tool behind it: record a sale, add a product, check stock, list recent orders, change an order's status, summarise takings by day/week/month, and remember business context across conversations.

**`(marketing)/metadata/page.tsx`** — *"Satu klik. Semua marketplace."* gains the actual names, rendered from `CLAIMABLE_MARKETPLACES` so the page cannot drift from the registry.

**`(marketing)/pricing/page.tsx`** — the hero says *"mulai dari gratis"* and the FAQ answers a quota question in terms of monthly resets. With Free now a one-time allowance, the FAQ gains an entry saying plainly that Free does not renew, and the hero copy stops implying an ongoing free tier.

### Not touched

`MarketplaceTabsMockup` hardcodes four names (Adobe Stock, Shutterstock, Vecteezy, Canva) as an illustration inside a device mockup. All four are claimable, it reads as art rather than a list, and wiring it to the registry would mean redesigning the mockup's layout for a variable count.

## Testing

`tests/lib/marketplaces.test.ts`, new:

- `CLAIMABLE_MARKETPLACES` excludes `designbundle` and has seven entries.
- Every key in `MARKETPLACES` matches a hardcoded copy of the extension's `ALL_MARKETPLACES`, so a future rename on either side fails the suite instead of silently denying access.
- `describeMarketplaces("*")` reports seven.
- `describeMarketplaces("adobe,shutterstock")` still lists exactly those two labels.
- `describeMarketplaces` ignores an unknown key rather than throwing.

**No existing test breaks.** `tests/lib/agent/pricing.test.ts`, `tool-loop.test.ts`, and
`turn.test.ts` each declare their own local `PRICING` fixture that happens to hold the
old numbers — they never import `DEFAULT_AI_PRICING`. `tests/lib/ai-settings.test.ts`
does import it, but compares by reference (`{ ...DEFAULT_AI_PRICING, inPerMTok: 3 }`),
so it follows whatever the constant becomes.

That is worth noticing rather than just relying on: the "~21 points per reply" figure
the original agent allowances were sized against (`1,000 / 11,000 / 30,000`) traces back
to those fixtures and to `DEFAULT_AI_PRICING` — a pricing configuration that has only
ever existed in tests and code defaults, never in the live database. The allowances were
calibrated against a world the product does not run in, which is why they were an order
of magnitude out.

No tests for the pages themselves — Vitest runs in a node environment and the codebase has no component tests.

## Verification

1. `npm run build && npm test` — green.
2. `/` — no phrase suggests the agent talks to the visitor's customers; no "tanpa instalasi rumit"; the trial is described in points.
3. `/agent` — hero makes clear it is the owner's assistant; every listed capability maps to a real tool; the pricing subheading does not imply Free grows.
4. `/metadata` — seven marketplaces named; Design Bundles absent.
5. `/pricing` — tier bullets read "Semua 7 marketplace"; the FAQ states that Free does not renew.
6. Clear all three rate fields in Pengaturan, then activate a Free metadata plan and run one generate: it succeeds, because the realigned defaults keep a generate at roughly one point.
7. `grep -rn "pelanggan Anda" src/app/\(marketing\)` returns nothing.

## Risks

**Seven versus eight will look like a bug.** A `"*"` plan grants eight marketplaces while every page says seven. That is deliberate, and the comment on `CLAIMABLE_MARKETPLACES` says so, but anyone comparing the extension's list to the site will notice the gap before they find the reason.

**Design Bundles users have no signal.** Removing the name means someone who uploads there sees no mention of it and assumes it is unsupported — when an adapter exists and may well work. That is the cost of not claiming what is unproven, and the fix is to run its QA rather than to soften the copy.

**Realigning `DEFAULT_AI_PRICING` changes behaviour for anyone relying on the old defaults.** Any environment that has never set the rate fields will start charging roughly one point per call instead of twenty-four. That is the intent, but it is a real change to metering in deployments that were coasting on defaults.
