# Navigation Shell Redesign — Design

**Date:** 2026-07-29
**Status:** Approved

## Problem

Navigation is one shared shell doing three jobs at once, and it has outgrown that.

`src/app/layout.tsx` wraps every route in one `Header` + `Footer`. The distinction between marketing pages and app pages is expressed as conditionals *inside* those shared components:

- `Header.tsx:38` picks between `GUEST_NAV`, `CUSTOMER_NAV`, and `ADMIN_NAV`.
- `Footer.tsx:17-19` returns `null` when a session exists.

That is a marketing shell and an app shell already, just written as `if` statements in components that serve both. The consequences:

1. **`CUSTOMER_NAV` is over capacity.** Seven items plus a points chip plus a Sign Out button inside `h-12 max-w-5xl`. The tenant app has nine pages and is still growing (Finance, points wallet, and auto-renew all landed in the last week).
2. **`/agent/dashboard` is unreachable from any nav.** It is the WhatsApp connection page — `lib/agent/webhook-handler.ts:68` tells users to go there over WhatsApp — but it appears in no nav array. `tests/lib/tenant-nav.test.ts` exists precisely because this class of bug "has already shipped twice"; this is the third.
3. **`callbackUrl` is discarded.** `middleware.ts:53` sets `callbackUrl` when bouncing a user to login, but `login/page.tsx:34` hardcodes `router.push("/dashboard")` and `GoogleButton.tsx:31` hardcodes `callbackUrl: "/dashboard"`. Deep links never survive a login.
4. **Admins land in the wrong place.** After login an admin goes to `/dashboard` — a tenant page — while their nav is `ADMIN_NAV`, which contains no `/dashboard` entry, so nothing highlights.
5. **Signed-in users can reach `/login` and `/register`.** Nothing sends them back.
6. **Guests have no pricing path from `/metadata` or `/agent`.** Plan `2026-07-19-multi-product-navigation.md` deliberately removed `/pricing` from the top nav, relying on an in-page `PricingTeaser` component instead. That component no longer exists in the codebase. `/pricing` is now reachable only from the landing page (`page.tsx:76`) and the footer.
7. **`Finance` sits next to `Produk`/`Transaksi`,** mixing the tenant's own shop orders with the tenant's billing relationship to Nerona.

## Outcome

Two explicit shells instead of one conditional shell. A sidebar with section headers for the app, a lean topbar for marketing, and a single role-aware landing point after login. No URL changes — route group names in parentheses do not appear in paths.

## Decisions

These were settled during design and should not be relitigated during implementation:

| Decision | Choice |
|---|---|
| Shell structure | Two shells via route groups; sidebar for the app |
| Signed-in user on `/` or `/pricing` | Page stays viewable; header CTA becomes `Dashboard →`. No hard redirect — `/pricing` is where tenants buy. |
| Tenant-facing plan purchase | New `(app)/paket` reusing `PricingSwitcher`; marketing `/pricing` unchanged |
| Nav label language | **Indonesian everywhere.** This revokes the "top-nav labels are English" decision from plan `2026-07-19`; `CUSTOMER_NAV` had already drifted to Indonesian and the body copy is Indonesian throughout. |
| `Harga` in guest top nav | Re-added. This revises `2026-07-19`, which is acceptable because the `PricingTeaser` that decision depended on no longer exists. |
| `Finance` grouping | Moves out of the shop group into `AKUN & TAGIHAN` |
| Sidebar width | Viewport-driven collapse: hidden below `sm`, 56px icon strip from `sm` to `xl`, full 224px at `xl`+. No user-facing toggle. |

## Architecture

### Route groups

Root `layout.tsx` keeps only `<html>`, `<body>`, and the font variable. All chrome moves into per-group layouts.

```
src/app/
  layout.tsx                    html/body/font only — no Header, no Footer
  (marketing)/layout.tsx        MarketingHeader + Footer
    page.tsx  agent/  metadata/  pricing/  learn/
  (app)/layout.tsx              AppShell(TENANT_NAV) + requireUser()
    dashboard/  produk/  transaksi/  finance/  profile/
    order/  account/  paket/  agent/chat/  agent/dashboard/
  (admin)/layout.tsx            AppShell(ADMIN_NAV) + requireAdmin()
    admin/                      → /admin, /admin/users, /admin/orders, /admin/pengaturan
  (auth)/layout.tsx             bare; redirects signed-in users to their role home
    login/  register/  reset-password/  verify-email/
  post-login/page.tsx           outside (auth) — see "Redirect flow"
  api/                          untouched
```

**`(admin)` is a sibling group, not a child of `(app)`.** Nesting it would apply both layouts, wrapping admin pages in the tenant sidebar *and* the admin sidebar. The `admin/` folder stays inside the group because it is the real URL segment.

`admin/layout.tsx`'s current `<h1>Admin</h1>` and `{email} · {role}` line are dropped — the topbar carries the section name and `AccountMenu` carries the identity. Its container (`mx-auto max-w-6xl px-6 py-12`) and a `<main>` element must be preserved inside `(admin)/layout.tsx`, because admin pages supply neither.

The per-page `requireUser()` calls in the nine app pages stay — they need the `session` object for data fetching, and the layout guard is defense in depth, mirroring how `middleware.ts:43-56` already duplicates the admin check.

### Nav configuration — `src/lib/nav.ts`

One module owns nav shape for every shell. `activeHref()` moves here from `HeaderNav.tsx:19` **with its logic unchanged** — the longest-match behavior is already correct and already tested.

```ts
export type NavItem = { href: string; label: string };
// Sidebar items carry a glyph for the collapsed strip. Requiring it here means
// an item with no icon cannot compile into a sidebar section.
export type SidebarItem = NavItem & { icon: IconName };
export type NavSection = { title?: string; items: SidebarItem[] };

export const MARKETING_NAV: NavItem[] = [
  { href: "/agent", label: "Agent" },
  { href: "/metadata", label: "Metadata" },
  { href: "/pricing", label: "Harga" },
];
// "Home" is dropped — the logo is the home link, per standard practice.
// No icons: the marketing nav is text-only, which is why NavItem stays separate.

export const TENANT_NAV: NavSection[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: "chart" }] },
  { title: "Agent", items: [
    { href: "/agent/chat", label: "Chat", icon: "chat" },
    { href: "/agent/dashboard", label: "Koneksi WhatsApp", icon: "link" },
  ]},
  { title: "Toko", items: [
    { href: "/produk", label: "Produk", icon: "box" },
    { href: "/transaksi", label: "Transaksi", icon: "receipt" },
  ]},
  { title: "Akun & Tagihan", items: [
    { href: "/paket", label: "Paket & Harga", icon: "tag" },
    { href: "/finance", label: "Finance", icon: "wallet" },
  ]},
];

export const ADMIN_NAV: NavSection[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: "chart" }] },
  { title: "Kelola", items: [
    { href: "/admin/users", label: "Pengguna", icon: "users" },
    { href: "/admin/orders", label: "Order", icon: "receipt" },
  ]},
  { title: "Sistem", items: [
    { href: "/admin/pengaturan", label: "Pengaturan", icon: "settings" },
  ]},
];

export function flatten(sections: NavSection[]): SidebarItem[];
export function activeHref(pathname: string, items: NavItem[]): string | null;  // moved as-is
export function pageTitle(pathname: string, sections: NavSection[]): string;    // label of the active item
```

`pageTitle()` derives the app topbar heading from the nav config, so no page has to thread a title prop.

### Components

| File | Kind | Responsibility |
|---|---|---|
| `components/layout/MarketingHeader.tsx` | server | `MARKETING_NAV`; right side is `Masuk` (text) + `Coba Gratis` (filled CTA), or `Dashboard →` when a session exists |
| `components/layout/AppShell.tsx` | server | Reads session and `getBalance()`, renders sidebar + topbar, accepts `sections: NavSection[]` |
| `components/layout/AppSidebar.tsx` | client | Section headers, active state via `usePathname`, three width states (see "Responsive behavior") |
| `components/ui/icons.tsx` | server-safe | The `ICONS` glyph map extracted from `admin/page.tsx:9-29` plus the eight glyphs the sidebar needs |
| `components/layout/AccountMenu.tsx` | client | Avatar dropdown: Profile, Sign Out — **reuses the confirmation `Modal` currently at `HeaderNav.tsx:147-169`** |

App topbar: page title on the left; points chip + `AccountMenu` on the right. On mobile the hamburger opens the sidebar drawer and the points chip stays visible in the topbar.

Two constraints from how the tenant pages are written today:

- **`AppShell` must not wrap `children` in `<main>`.** All nine tenant pages already open with their own `<main>` (e.g. `dashboard/page.tsx:42`, `finance/page.tsx:73`); a wrapper would nest `<main>` inside `<main>`. Use a plain `<div className="min-w-0 flex-1">`.
- **The topbar title is a `<span>`, not a heading, and the pages keep their `<h1>`.** Every tenant page has one (`<h1>Dashboard</h1>`, `<h1>Finance</h1>`, …). Rendering the name small in the topbar and large in the page is the Vercel/Linear pattern, and it avoids editing nine pages to strip headings. `pageTitle()` output is a locator, so it must not be an `<h1>` — that would create two competing top-level headings per page.

### Responsive behavior

Tailwind breakpoints measure the **viewport**, but a sidebar narrows the **content column**. A fixed 224px sidebar therefore silently breaks grids that were tuned without one. Six grid declarations are exposed — `dashboard/page.tsx:46,102`, `admin/page.tsx:206,248,337`, `admin/pengaturan/page.tsx:7` — and the worst case is concrete rather than theoretical: `Stat` renders its value at `text-2xl font-bold` (`dashboard/page.tsx:27`), and "Rp 4.250.000" needs roughly 165px.

A viewport-driven collapse keeps every one of those grids working untouched:

| Viewport | Sidebar | Content column | After `px-6` | Per stat card (4 cols, `gap-4`) | Text room after `p-5` |
|---|---|---|---|---|---|
| < 640px | drawer | full | — | 2 cols | ample |
| 640px | 56px strip | 584px | 536px | 260px (2 cols) | 220px |
| 1024px (`lg:grid-cols-4` fires) | 56px strip | 968px | 920px | **218px** | **178px** ✓ |
| 1280px (`xl`) | 224px full | 1056px → capped 1024px | 976px | **232px** | 192px ✓ |
| *rejected: fixed 224px* | *224px* | *800px* | *752px* | *176px* | *136px* ✗ |

The last row is why the strip exists. At 1280px the numbers return to exactly what they were before the sidebar existed, and **no grid class changes anywhere in the codebase.**

The three states:

- **Below `sm`** — no sidebar; the topbar hamburger opens a `w-64` drawer that always shows full labels, because an overlay has room.
- **`sm` to `xl`** — a `w-14` icon-only strip. Each item is its glyph plus `title` and `aria-label` carrying the label. Section titles are replaced by a thin divider, since "AKUN & TAGIHAN" cannot fit 56px.
- **`xl` and up** — the full `w-56` sidebar with labels and section headers.

This requires `NavItem` to carry an icon, so `nav.ts` gains an `icon: IconName` field. The name is a **string key**, not a `ReactNode` — `lib/nav.ts` must stay JSX-free for the node-environment test suite, so it imports `IconName` as a type only.

Glyphs come from `components/ui/icons.tsx`, which is `ICONS` lifted out of `admin/page.tsx:9-29` (Feather-style, 24px viewBox, `stroke="currentColor"`, `strokeWidth={2}`). `users`, `chat`, `key`, and `clock` already exist; the sidebar adds `home`, `link`, `box`, `receipt`, `tag`, `wallet`, `chart`, and `settings`. `admin/page.tsx` then imports from the shared module instead of holding its own copy.

**No user-facing collapse toggle.** The width follows the viewport only. A manual toggle would need persisted state and a control in the chrome; the arithmetic above is already solved without it, so it stays out of scope.

`Header.tsx` and `HeaderNav.tsx` are deleted once every caller has moved. `Footer.tsx` loses its `if (session) return null` guard — it now lives only in `(marketing)` — but its `FOOTER_LINKS` must swap `Masuk` for `Dashboard` when a session exists, because signed-in users will now see the footer on marketing pages where previously it was hidden.

### `(app)/paket` — plan purchase inside the app shell

`PricingSwitcher` is a pure client component taking a `products` prop (`PricingSwitcher.tsx:17`), so the tenant page reuses it against the same data source with nothing duplicated:

```tsx
// (app)/paket/page.tsx — server component
const session = await requireUser();
const tiers = await metadataTiers();        // same lib/pricing-tiers.ts as /pricing
<PricingSwitcher products={[
  { key: "metadata", label: "🖼️ Metadata",
    subheading: "Metadata otomatis untuk kontributor stock.", tiers },
  { key: "agent", label: "💬 Agent",
    subheading: "Asisten AI WhatsApp untuk pemilik bisnis.", tiers: agentTiers() },
]} />
```

Deliberately **not** carried over from `/pricing`: the hero, `StepsSection`, `FaqSection`, and `CtaBanner` — the banner's CTA is "Buat akun gratis" → `/register`, which is meaningless for a signed-in user. Those stay marketing-only.

Two cross-links tie it together:
- `/finance` gains a "Beli / perpanjang paket" button → `/paket`, replacing the dead-end copy at `finance/page.tsx:143-145` ("Hubungi admin untuk isi ulang").
- Marketing `/pricing` shows a small banner → `/paket` when the visitor is already signed in.

### Redirect flow

`src/lib/auth-redirect.ts`:

- `homeForRole(user: { role?: string | null }): string` → `user.role ? "/admin" : "/dashboard"`
- `safeCallbackUrl(raw: string | null | undefined): string | null` → returns `raw` only if it starts with `/` and is **not** `//` or `/\`. This blocks open redirects to `//evil.com`, which the browser reads as protocol-relative.

`src/app/post-login/page.tsx` — one server-side landing point shared by credentials login and Google OAuth:

```ts
const session = await requireUser();
const next = typeof searchParams.next === "string" ? searchParams.next : null;
redirect(safeCallbackUrl(next) ?? homeForRole(session.user));
```

The `typeof` narrowing matters: Next passes a repeated query parameter as `string[]`, and `?next=/a&next=//evil.com` must not slip past a check written for a plain string.

**`post-login` must live outside `(auth)`.** Inside it, the `(auth)` layout's "signed-in users go to their role home" redirect would fire first and swallow the `next` parameter.

Call sites:

- `login/page.tsx:34` → `router.push("/post-login?next=" + encodeURIComponent(cb))`, where `cb = searchParams.get("callbackUrl")` from the `useSearchParams()` hook already present at line 13 (it currently reads only `"error"`). When `cb` is absent, push a bare `/post-login`. Keep `redirect: false` on `signIn` so the inline "Email atau kata sandi salah" handling at lines 28-32 still works.
- `GoogleButton.tsx:31` → `callbackUrl: "/post-login…"`, no longer `/dashboard`.
- `(auth)/layout.tsx` → session present? `redirect(homeForRole(session.user))`.
- `session-guards.ts:16` → `requireAdmin` sends a non-admin to `/dashboard`, not `/profile`. `/dashboard` is their actual home; `/profile` was arbitrary.
- `requireUser()` currently drops the intended path at `session-guards.ts:8`. `middleware.ts:64` already puts `x-nonce` on the request headers — add `x-pathname` the same way, then have `requireUser` read it via `headers()` and build `?callbackUrl=`.

## Implementation sequence

One plan, but the order is load-bearing rather than cosmetic — each step ends at a state where the app builds and runs:

1. **Move folders into route groups.** Root layout keeps `Header`/`Footer` for now so nothing visually changes. Build here to clear the route-group risk in isolation.
2. **Build `lib/nav.ts` and `components/ui/icons.tsx`** — extract `ICONS` from `admin/page.tsx` and add the eight new glyphs; move `activeHref` out of `HeaderNav.tsx`, add `flatten`/`pageTitle`, define the three nav configs with icons. Update `tenant-nav.test.ts`.
3. **Build the shells** — `MarketingHeader`, `AppShell`, `AppSidebar`, `AccountMenu`. Wire the four group layouts, strip the root layout to `html`/`body`, delete `Header.tsx` and `HeaderNav.tsx`, adjust `Footer.tsx`.
4. **Redirect layer** — `lib/auth-redirect.ts`, `post-login/page.tsx`, the `(auth)` layout guard, `x-pathname` in middleware, `session-guards.ts`, and the two login call sites.
5. **`(app)/paket`** plus the two cross-links in `/finance` and `/pricing`.

## Testing

- **`tests/lib/tenant-nav.test.ts`** (extend) — `flatten(TENANT_NAV)` must contain `/agent/chat`, **`/agent/dashboard`**, and `/paket`; no duplicate hrefs; `activeHref` distinguishes `/agent/chat` from `/agent/dashboard` and neither steals highlight from `/dashboard`. Same reachability assertions for `ADMIN_NAV`. This preserves the file's stated purpose while closing the third instance of its bug.
- **`tests/lib/auth-redirect.test.ts`** (new) — `safeCallbackUrl` rejects `//evil.com`, `https://evil.com`, `/\evil.com`, `null`; accepts `/admin/users`. `homeForRole` returns `/admin` for a role and `/dashboard` for `null`.
- **`tests/lib/session-guards.test.ts:46`** (update) — expected redirect becomes `/dashboard`.
- No unit tests for the shell components, matching the existing convention that layout and marketing components are untested.

## Verification

1. `npm run build` **immediately after the folder moves, before touching any shell component** — see Risks.
2. `npm test` — all suites green.
3. `npm run lint`.
4. Manual, signed out: `/` shows `Agent · Metadata · Harga` + `Masuk` + `Coba Gratis`; footer present.
5. Manual, tenant: `/dashboard` renders inside the sidebar shell; every sidebar item resolves and highlights correctly; `/agent/dashboard` is reachable from the sidebar; `/paket` shows both product tiers; `/` shows `Dashboard →`.
6. Manual, admin: login lands on `/admin`, not `/dashboard`; admin sidebar renders.
7. Manual, deep link: visit `/admin/users` signed out → login → land on `/admin/users`, not `/dashboard`.
8. Manual, open redirect: visit `/post-login?next=//example.com` while signed in → lands on the role home, never leaves the origin.
9. Manual, three widths — this is where the collapse arithmetic is confirmed:
   - **< 640px:** no sidebar; hamburger opens the drawer with full labels; points chip stays in the topbar.
   - **~1024px:** 56px icon strip; every glyph shows its label on hover via `title`; the dashboard stat row is four columns and **"Rp 4.250.000" fits on one line** — this is the regression the strip exists to prevent.
   - **≥ 1280px:** full 224px sidebar with labels and section headers; stat cards match their pre-redesign width.
10. Manual, `/admin/users` at ~1024px: the `min-w-[720px]` table scrolls inside its own `overflow-x-auto` wrapper (`AdminUsersDirectory.tsx:179`) and the page itself does not scroll sideways.

## Risks

**Route group split across a shared segment.** `/agent` lives in `(marketing)` while `/agent/chat` and `/agent/dashboard` live in `(app)`. The full paths differ, so Next 14 should accept it, but this is a fragile area of the App Router. Run `npm run build` immediately after the moves and before any component work, so a failure has exactly one possible cause.

If it does fail, the fallback that preserves URLs is to keep `agent/` outside both groups with a local layout that renders the marketing chrome for `/agent` and the app chrome for its children.
