# Metadata-First Positioning (Agent Hidden Behind a Flag)

**Date:** 2026-07-31
**Status:** Approved

## Problem

Nerona sells two products and the site says so, but the owner is only selling one of them right now. The whole surface argues against that focus.

**The visitor is asked to choose.** `(marketing)/page.tsx` is a two-product company home: the hero promises *"alat AI untuk kontributor dan pemilik bisnis"*, `ProductCards` offers Metadata and Agent side by side, and two `FeatureSection`s give each equal weight. A visitor who came to buy metadata has to pick a door first.

**Signing in makes it worse.** `/dashboard` is entirely a shop: revenue this month, orders this month, active products, unpaid count, a 30-day sales chart, top products, low stock. None of it belongs to a stock contributor. The sidebar then offers an **Agent** group (Chat, Koneksi WhatsApp) and a **Toko** group (Produk, Transaksi) — the shop the agent operates through `add_product` and `record_sale`. A metadata customer logs in and lands on someone else's product.

**The one page that does sell metadata is not the front door.** `(marketing)/metadata/page.tsx` has the hero, three feature sections, the marketplace row and the pricing table — a complete sales page sitting one click away from the home page, competing with a company overview that says less.

Agent is 62 source files and 23 test files. Deleting it is not on the table; the code is fine, the timing is wrong.

## Outcome

`/` is a single-product sales page for Nerona Metadata. A signed-in customer sees only metadata. Every agent surface is off behind one constant, and turning it back on restores them — the payment flow is untouched throughout.

Reference for the sales-page shape: sendstockai.com, which is one page — hero, pain, features, platforms, pricing, FAQ. The structure is borrowed. The social-proof block is not (see Decisions).

## Decisions

| Decision | Choice |
|---|---|
| How deep the hiding goes | Public **and** in-app. WhatsApp webhook and agent cron stay alive. |
| Landing shape | `/` becomes the metadata sales page; `/metadata` redirects to `/` |
| The switch | One code constant, `AGENT_ENABLED` in `src/lib/features.ts` |
| Tenant shell | Agent **and** Toko groups leave the sidebar; `/dashboard` rebuilt for metadata |
| Social proof | None. No invented figures, no live counter, no testimonial placeholders. |
| Existing paying agent customers | No exception — the web surfaces go for everyone |
| Payment flow | Unchanged: pick plan → order → transfer → upload proof → admin verifies |

### Why a constant and not an env var or a Setting row

An env var lives outside the repo, so local and production can disagree with nothing to read. A `Setting` row buys an admin toggle at the cost of a DB read on every nav render plus admin UI, which is expensive for a switch that will be flipped twice. A constant is visible in git, costs nothing at runtime, and — once nav and pricing are pure functions of it (see Architecture) — is testable in both positions.

### Why no social proof

sendstockai leans on *"2,000+ contributors, 15M+ keywords generated"*. Copying that shape with invented numbers is exactly what [[2026-07-29-marketing-honesty-design]] exists to prevent. A live `COUNT(metadata_logs)` was offered and declined. So the page claims only what the product does: seven marketplaces, autofill, batch, reject analysis.

### Why existing agent customers get no exception

Hiding the surfaces while the webhook keeps answering means a paying agent customer is served but cannot see the plan, its expiry, or the top-up path. The alternative — showing agent surfaces to anyone holding a paid `agentProfile` — was considered and rejected by the owner in favour of the simpler rule. **The consequence is accepted deliberately: their plan runs to its expiry and is not renewed** (see Renewals below), and the owner tells them directly rather than through the UI.

## Architecture

### The switch, and making it testable

```ts
// src/lib/features.ts
/** Agent is hidden while Nerona sells metadata only. Flip to true to restore
 *  every surface below; nothing about agent's logic is conditional on it. */
export const AGENT_ENABLED = false;
```

A bare constant cannot be exercised in both positions from a test, so the things it gates become pure functions of it and the exported constants are the applied result:

```ts
// src/lib/nav.ts
export function marketingNav(agentEnabled: boolean): NavItem[]
export function tenantNav(agentEnabled: boolean): NavSection[]
export const MARKETING_NAV = marketingNav(AGENT_ENABLED);
export const TENANT_NAV = tenantNav(AGENT_ENABLED);
```

Every existing consumer keeps importing the constants unchanged. `pricingProducts(agentEnabled = AGENT_ENABLED)` takes the same treatment.

### Public surfaces

| Surface | With the flag off |
|---|---|
| `(marketing)/page.tsx` | Renders `<HomeMetadataOnly />`; renders `<HomeMultiProduct />` when on |
| `(marketing)/metadata/page.tsx` | `redirect("/")` — its content now lives on the home page |
| `(marketing)/agent/page.tsx` | `redirect("/")` |
| `MARKETING_NAV` | `Fitur` (`/#fitur`), `Harga` (`/pricing`), `FAQ` (`/#faq`) |
| `Footer.tsx` | Tagline drops "dan pemilik bisnis"; `/agent` and `/metadata` links removed |
| `lib/pricing-products.ts` | Returns the metadata product only, so `/pricing` and `/paket` lose the Agent tab |
| `ProductCards.tsx` | Unused by the new home page; kept for `HomeMultiProduct` |

**"Harga" in the nav points at `/pricing`, not at the landing's own pricing section.** The approved mockup scrolled it in-page, but `/pricing` is the only place the 3/6/12-month duration switcher lives, and making all three nav items in-page anchors would orphan it — a discount tool nothing links to. So: the hero's secondary CTA scrolls to `#pricing` on the page, and the nav item goes to the full pricing page. Both are useful; the redundancy is deliberate.

**Redirects live in the page, not `next.config.mjs`.** The config is `.mjs` and cannot import `features.ts`, so putting the rules there would mean the switch's value exists in two places that can disagree. The existing `/learn` redirect in the config stays as it is — it is not conditional on anything.

**`HomeMultiProduct` is kept, not deleted.** Otherwise flipping `AGENT_ENABLED` back to `true` would restore the nav and the routes but leave the home page single-product, and the switch would be lying. The cost is roughly 150 lines of idle JSX, which is what a temporary switch is for.

### The new home page

Eleven sections, nine of them existing components rearranged:

| Section | Source |
|---|---|
| Hero | `Hero.tsx` + `MetadataCardMockup`. Primary CTA becomes **"Mulai gratis"** → `/register`, with "Lihat harga" second — a sales page asks for the signup, not for the price table. |
| Kenapa unggahan Anda tertahan | **New.** Three contributor complaints; no statistics. |
| Satu klik. 7 marketplace. | `FeatureSection` + `MarketplaceTabsMockup`, `id="fitur"` |
| Kata kunci yang konsisten | `FeatureSection` + `KeywordChipsMockup` |
| Dibuat untuk unggahan massal | `FeatureSection` + `BatchProgressMockup`; bullets state 50 per batch, from the extension's `BATCH_MAX_ITEMS` |
| Ditolak? Cari tahu kenapa | **New.** `FeatureSection theme="navy"` + a new reject-analysis mockup. Says plainly that it is a Business-plan feature. |
| Marketplace row | `MarketplaceRow` — seven names from `CLAIMABLE_MARKETPLACES` |
| Mulai dalam tiga langkah | `StepsSection`; the sentence *"Untuk Agent cukup hubungkan nomor WhatsApp toko Anda"* goes |
| Harga | `PricingTiers` + `metadataTiers()`, `id="pricing"`, monthly only — the 3/6/12 duration switcher stays on `/pricing` |
| FAQ | `HOME_FAQ` minus the agent question, plus one on installing the extension |
| CTA penutup | `CtaBanner`; drops the agent point figure |

The navy band matters structurally: the agent `FeatureSection` was the home page's only dark section, so removing it leaves eleven light sections in a row. Reject analysis takes that slot — a feature already sold in the Business tier that has never had a section of its own.

Approved mockup: <https://claude.ai/code/artifact/bc6d1ec3-bf4e-48a7-9f97-275365c2b9ed>

### Tenant shell

**Sidebar** becomes Dashboard → Metadata (Riwayat) → Akun & Tagihan (Paket & Harga, Finance). The Agent and Toko groups both leave: the shop exists to be operated by the agent, so without it those pages are manual bookkeeping. **No shop data is deleted** — the pages and their queries stay, unreachable until the flag flips.

**`/dashboard` is rebuilt** from functions that already exist:

| Card | Source |
|---|---|
| Saldo poin | `getBalance()` |
| Paket & masa aktif | `prisma.license.findFirst` — the same query `/finance` uses |
| Metadata 7 hari terakhir | `getMetadataLogStats().last7Days` |
| Total metadata | `getMetadataLogStats().total` |
| Marketplace teratas | `getMetadataLogStats().perMarketplace` |
| Riwayat metadata terbaru | `listMetadataLogsForUser(id, 5)` → link to `/riwayat-metadata` |
| Riwayat poin | `listTransactions(id, 5)` → link to `/finance` |

Out: `getDashboardSummary` and `getSalesSeries` (revenue, order count, active products, unpaid, sales chart, top products, low stock). Both helpers stay in `lib/shop-dashboard.ts`.

**Extension onboarding shows according to state.** `ExtensionConnectPanel` is a large panel — three install steps plus token management — and copying it onto the dashboard would leave two places to maintain. Instead the dashboard reads the user's `ExtensionToken` rows: none, or none with `lastUsedAt` set → a full-width callout ("Ekstensi belum terhubung") linking to the panel on `/profile`; otherwise a quiet status line. The panel itself is not moved or duplicated.

**Two sentences become false and are rewritten.** `dashboard/page.tsx:68` and `finance/page.tsx:173` both read *"Poin dipakai untuk balasan AI asisten WhatsApp."* Points are one shared wallet for both products; in a metadata-only product that sentence misleads.

### Orders and renewals

**Creation is blocked at one choke point.** `isProduct` (`lib/orders.ts:15`) is the single validator, called from `createOrderRequest` (line 149), which both `/order` and `POST /api/orders` go through. Gating it there rejects `product=agent` from the page and the API at once, returning the existing `invalid_product` → 400 "Produk tidak dikenal."

**Fulfilment is not blocked.** `isProduct` is not on the fulfilment path (`orders.ts:322-390` branches on `order.product` directly), so an agent order already placed can still be verified and activated by an admin. Blocking that would trap a customer's money in a pending order.

**Renewals stop being generated — a different job from the agent cron.** Two things are called "cron" here and only one is touched: `/api/agent/cron` drives agent message jobs and is left alone, while the billing job below generates renewal invoices and skips agent. `generateDueRenewals` (`lib/billing/renewals.ts:58`) creates renewal requests for agent plans, and the "Perpanjangan paket jatuh tempo" banner on `/finance` would then show *"Agent WhatsApp — pro"* on a page that no longer knows what Agent is. So the job skips the agent pass while the flag is off, and `listPendingRenewals` (`orders.ts:419`) filters agent rows out of the banner. This is what makes existing agent plans expire without renewal — the accepted consequence recorded above.

**Purchase history keeps saying "Agent".** The `product === "agent" ? "Agent" : "Metadata"` label in the `/finance` purchase list (`finance/page.tsx:69`) stays. That row is money the customer actually spent; hiding or relabelling it would misstate a transaction.

**`/finance` gains an empty state.** With the agent row gone, a user with no metadata license renders an empty "Paket" list. It gets "Belum ada paket aktif" and a link to `/paket`. `TopupCard`'s `hasActivePlan` becomes `Boolean(license)`.

### Hidden app routes and APIs

`/agent/chat` and `/agent/dashboard` → `redirect("/dashboard")`, not 404, so an old bookmark lands somewhere useful. `POST /api/agent/chat`, `/api/agent/link`, `/api/agent/status` return 403 `agent_disabled` — a hidden page must not leave a live API behind it.

**Untouched:** `/api/whatsapp/webhook` and `/api/agent/cron`, per the decision to keep serving existing WhatsApp users. **`/api/extension/*` is not touched by a single line** — it is the product being sold. Admin pages are not touched either; the owner still needs to see agent state.

## Testing

Vitest, node environment, 73 test files, and **no component tests at all** (`tests/**/*.test.tsx` does not exist).

**`tests/lib/tenant-nav.test.ts` fails as written** and is rewritten, not deleted. Lines 25 and 29 assert the sidebar contains `/agent/chat` and `/agent/dashboard`; line 128 asserts `pageTitle("/agent/dashboard")` is "Koneksi WhatsApp". Those tests exist precisely so nobody removes the agent entry points by accident — and here we remove them on purpose. The rewrite pins both positions:

- `tenantNav(true)` contains `/agent/chat` and `/agent/dashboard`; `tenantNav(false)` contains neither.
- `tenantNav(false)` contains no Toko group; `tenantNav(true)` still has `["/produk", "/transaksi"]`.
- `tenantNav(false)` still reaches `/riwayat-metadata`, `/paket`, `/finance`, and never `/metadata`.
- `marketingNav(false)` has no `/agent`; `marketingNav(true)` does. Neither contains `/`.
- No duplicate destinations and a valid glyph for every item, in both positions.

New tests:

- `pricingProducts(false)` returns one product keyed `metadata`; `pricingProducts(true)` returns both.
- `createOrderRequest` with `product: "agent"` returns `invalid_product` when the flag is off, and succeeds when on.
- `generateDueRenewals` creates no agent renewal with the flag off, while still creating metadata renewals.
- `listPendingRenewals` omits agent rows with the flag off.

The 23 `tests/lib/agent/**` files must stay green untouched — the flag gates surfaces, never agent logic.

**Not testable here:** the home page and the dashboard render. There is no component-test infrastructure in this repo, so those are verified by `npm run build` and by eye in a browser. They will not be described as tested.

## Verification

1. `npm test` — green, including the rewritten nav suite.
2. `npm run build` — succeeds.
3. `/` — one product; sections in the order above; the navy reject-analysis band present; no social-proof figures anywhere.
4. `/metadata` and `/agent` — both land on `/`.
5. Top nav shows Fitur / Harga / FAQ; `#fitur` and `#faq` scroll to the right sections; footer has no Agent or Metadata link and no "pemilik bisnis".
6. `/pricing` and `/paket` — no Agent tab, metadata tiers only, duration switcher still working on `/pricing`.
7. Sign in as a tenant: sidebar has no Agent and no Toko group; `/dashboard` shows points, plan, metadata counts, and the extension callout; neither `/dashboard` nor `/finance` says points are for WhatsApp replies.
8. `/agent/chat` and `/agent/dashboard` by direct URL → `/dashboard`. `curl -X POST /api/agent/chat` → 403 `agent_disabled`.
9. `/order?product=agent&plan=Pro` → "Produk tidak dikenal." Same for `POST /api/orders` with `product: "agent"`.
10. `POST /api/whatsapp/webhook` still processes a message end to end, and a generate through the extension still works — the two things that must not break.
11. Set `AGENT_ENABLED = true`, rebuild: the two-product home page, both marketing pages, the Agent tab, and both sidebar groups all return.

## Risks

**Existing agent customers lose sight of what they bought.** Accepted by the owner. Their WhatsApp keeps working and their plan expires without a renewal invoice; nothing in the web UI tells them. This needs a message from the owner, and the spec cannot substitute for it.

**Hidden is not gone.** 62 agent source files, the shop pages, `getDashboardSummary`, `getSalesSeries`, `ProductCards`, and `HomeMultiProduct` all stay compiled and tested while unreachable. That is the price of a reversible switch, and it means a reader of the codebase will see far more product than the site sells.

**The switch does not cover everything a re-enable needs.** Flipping it back restores nav, routes, pricing tabs, and the home page. It does **not** restore agent renewals that were skipped while it was off, and it does not un-expire a plan that lapsed in the meantime.

**Prices in the mockup are seed values.** The mockup shows Rp 99.000 and Rp 199.000 from `prisma/seed.ts`; the live database may differ since prices became admin-editable. The real page reads from the DB, so this affects only the mockup's fidelity — but anyone comparing the two will notice.
