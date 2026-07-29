# Navigation Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single conditional navigation shell into a marketing shell (topbar + footer) and an app shell (sidebar + thin topbar) via Next.js route groups, and add a role-aware post-login landing point that honors `callbackUrl`.

**Architecture:** Four route groups under `src/app/` — `(marketing)`, `(app)`, `(admin)`, `(auth)` — each owning its own chrome, with the root layout reduced to `<html>`/`<body>`. Nav shape moves into one pure-TypeScript module (`src/lib/nav.ts`) so the node-environment test suite can import it directly. Redirect decisions move into `src/lib/auth-redirect.ts` plus a single `/post-login` server route shared by credentials and Google sign-in.

**Tech Stack:** Next.js 14.2 (App Router), React 18, TypeScript, Tailwind CSS 3, NextAuth 4, Vitest — all existing, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-29-nav-shell-redesign-design.md`

## Global Constraints

- **No URL changes.** Route group names in parentheses do not appear in paths. Every path that works today must work identically after this plan.
- **Nav labels are Indonesian.** This revokes the "top-nav labels are English" constraint from `docs/superpowers/plans/2026-07-19-multi-product-navigation.md`. Product names (`Agent`, `Metadata`, `Dashboard`, `Chat`, `Finance`, `Profile`) stay as-is because they are proper nouns or already-established labels.
- **Tests are `.ts` only, node environment.** `vitest.config.ts` sets `include: ["tests/**/*.test.ts"]` and `environment: "node"` — there is no DOM. Do not write `.test.tsx`, and do not add tests for React components. `src/lib/nav.ts` must contain no JSX so the node-env suite can import it.
- **No new unit tests for layout or marketing components** — matches the existing convention that `Header`, `HeaderNav`, `Footer`, `Hero`, and the mockup components have no test files.
- **`AppShell` must not wrap `children` in `<main>`.** All nine tenant pages already open with their own `<main>`; a wrapper would nest `<main>` inside `<main>`.
- **The topbar page title is a `<span>`, never a heading.** Tenant pages keep their existing `<h1>`. Two `<h1>`s per page is the failure mode being avoided.
- **Tailwind tokens only** (from `tailwind.config.ts`): `canvas`, `surface`, `surface2`, `ink`, `muted`, `navy-900`, `brand-blue`, `brand-orange`, `gold-400`, `gold-500`. No raw hex except the two already in the codebase: `#9A6B08` (points chip text) and `#C25717`/`#3B65C4` (pricing tabs).
- **Do not change a single grid class.** Six declarations (`dashboard/page.tsx:46,102`, `admin/page.tsx:206,248,337`, `admin/pengaturan/page.tsx:7`) use `lg:` breakpoints tuned for a full-width page. The sidebar's collapsed 56px strip is sized precisely so they all keep working — at 1024px a stat card is 218px wide with 178px of text room, and `Stat`'s `text-2xl font-bold` "Rp 4.250.000" needs ~165px. A fixed 224px sidebar would give 176px/136px and break it. If a grid looks wrong, the sidebar width is the bug, not the grid.
- **Leave the per-page `requireUser()` calls alone.** All nine tenant pages call it for the `session` object they need to fetch data; the new `(app)/layout.tsx` guard is defense in depth, mirroring how `src/middleware.ts:43-56` already duplicates the admin check. Do not "de-duplicate" them.
- **Commit after every task.** The working tree is clean on `master` at the start.

---

### Task 1: Move routes into the four groups

Purely mechanical file moves. The root layout keeps rendering `Header`/`Footer` for now, so nothing changes visually or behaviorally. This task exists on its own so that if Next rejects the `/agent` split across groups, the failure has exactly one possible cause.

**Files:**
- Move: `src/app/{page.tsx,agent/page.tsx,metadata/,pricing/,learn/}` → `src/app/(marketing)/…`
- Move: `src/app/{dashboard/,produk/,transaksi/,finance/,profile/,order/,account/,agent/chat/,agent/dashboard/}` → `src/app/(app)/…`
- Move: `src/app/admin/` → `src/app/(admin)/admin/`
- Move: `src/app/{login/,register/,reset-password/,verify-email/}` → `src/app/(auth)/…`
- Unchanged: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/api/`

**Interfaces:**
- Consumes: nothing.
- Produces: the four route groups. Every later task edits or adds files inside them. No exported symbols.

`src/app/(marketing)/page.tsx` is the site landing page (today's `src/app/page.tsx`). Note that `src/app/(marketing)/agent/page.tsx` and `src/app/(app)/agent/chat/page.tsx` both contain an `agent` segment in different groups — this is the risk this task isolates.

- [ ] **Step 1: Create the group directories**

```bash
cd nerona-web/src/app
mkdir -p "(marketing)" "(app)" "(admin)" "(auth)"
```

- [ ] **Step 2: Move the marketing routes**

```bash
cd nerona-web/src/app
git mv page.tsx "(marketing)/page.tsx"
git mv metadata "(marketing)/metadata"
git mv pricing "(marketing)/pricing"
git mv learn "(marketing)/learn"
mkdir -p "(marketing)/agent"
git mv agent/page.tsx "(marketing)/agent/page.tsx"
```

- [ ] **Step 3: Move the app routes**

`agent/` still holds `chat/` and `dashboard/` after Step 2 removed its `page.tsx`.

```bash
cd nerona-web/src/app
for d in dashboard produk transaksi finance profile order account agent; do
  git mv "$d" "(app)/$d"
done
```

- [ ] **Step 4: Move the admin and auth routes**

```bash
cd nerona-web/src/app
mkdir -p "(admin)"
git mv admin "(admin)/admin"
for d in login register reset-password verify-email; do
  git mv "$d" "(auth)/$d"
done
```

- [ ] **Step 5: Verify the tree**

Run: `cd nerona-web && find src/app -maxdepth 2 -mindepth 1 -type d | sort`

Expected: only `(admin)`, `(admin)/admin`, `(app)`, `(app)/<nine dirs>`, `(auth)`, `(auth)/<four dirs>`, `(marketing)`, `(marketing)/<four dirs>`, `api`, and `api`'s children. No bare `dashboard`, `admin`, `login`, or `pricing` directly under `src/app`.

- [ ] **Step 6: Build — this is the gate for the whole plan**

Run: `cd nerona-web && npm run build`
Expected: succeeds. Route list in the output shows `/`, `/agent`, `/agent/chat`, `/agent/dashboard`, `/metadata`, `/pricing`, `/dashboard`, `/produk`, `/transaksi`, `/finance`, `/profile`, `/order`, `/account`, `/admin`, `/admin/users`, `/admin/orders`, `/admin/pengaturan`, `/login`, `/register`, `/reset-password`, `/verify-email` — the same paths as before the move.

If the build fails complaining about the `agent` segment, stop and apply the spec's documented fallback: move `agent/` back to `src/app/agent/` (outside all groups) and give it a local `layout.tsx` that renders the marketing chrome for its `page.tsx` and the app chrome for `chat`/`dashboard`. Do not proceed to Task 2 with a red build.

- [ ] **Step 7: Run the existing tests**

Run: `cd nerona-web && npm test`
Expected: all suites pass. Nothing imports from `src/app/`, so the moves cannot break them — this confirms that.

- [ ] **Step 8: Commit**

```bash
cd nerona-web
git add -A src/app
git commit -m "refactor: move routes into (marketing)/(app)/(admin)/(auth) groups

No URL or behavior change — route group names do not appear in paths.
The root layout still supplies Header/Footer; per-group chrome lands next."
```

---

### Task 2: The nav's data — icon set and `src/lib/nav.ts`

The glyph map and the nav config are one deliverable: the sidebar's collapsed strip has nothing to render without both.

**Files:**
- Create: `src/components/ui/icons.tsx`
- Create: `src/lib/nav.ts`
- Modify: `src/app/admin/page.tsx:9-29,39-56` — import `Icon` from the shared module instead of keeping a private `ICONS` map
- Modify: `tests/lib/tenant-nav.test.ts` (replace contents; keep the filename and the intent of its doc comment)
- Do NOT yet modify: `src/components/layout/Header.tsx`, `src/components/layout/HeaderNav.tsx` — Task 4 and Task 5 delete them. They keep their own copy of `activeHref` until then so the build stays green.

Note the admin page is at `src/app/(admin)/admin/page.tsx` after Task 1.

**Interfaces:**
- Consumes: nothing.
- Produces, all imported by Tasks 4, 5, and 7:
  - From `@/components/ui/icons`: `type IconName`, `Icon({ name, className }: { name: IconName; className?: string })`
  - `type NavItem = { href: string; label: string }`
  - `type SidebarItem = NavItem & { icon: IconName }`
  - `type NavSection = { title?: string; items: SidebarItem[] }`
  - `MARKETING_NAV: NavItem[]`
  - `TENANT_NAV: NavSection[]`
  - `ADMIN_NAV: NavSection[]`
  - `flatten(sections: NavSection[]): SidebarItem[]`
  - `activeHref(pathname: string, items: NavItem[]): string | null`
  - `pageTitle(pathname: string, sections: NavSection[]): string`

`SidebarItem` extends `NavItem`, so `SidebarItem[]` satisfies `activeHref`'s parameter and the marketing nav needs no icons.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/lib/tenant-nav.test.ts`. The original file's purpose — pinning tenant entry points because unreachable pages "already shipped twice" — is preserved and extended to the third case (`/agent/dashboard`).

```ts
import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "@/components/ui/icons";
import {
  ADMIN_NAV,
  MARKETING_NAV,
  TENANT_NAV,
  activeHref,
  flatten,
  pageTitle,
} from "@/lib/nav";

/**
 * Signing in swaps the marketing nav for the app sidebar. Anything a tenant
 * needs but cannot reach from there is effectively invisible — that has
 * already shipped three times: once for /pricing, once for the agent chat,
 * and once for /agent/dashboard (the WhatsApp connection page that
 * lib/agent/webhook-handler.ts tells users to visit). These tests pin the
 * entry points.
 */
describe("tenant navigation", () => {
  const hrefs = flatten(TENANT_NAV).map((item) => item.href);

  it("lets a tenant reach the agent chat", () => {
    expect(hrefs).toContain("/agent/chat");
  });

  it("lets a tenant reach the WhatsApp connection page", () => {
    expect(hrefs).toContain("/agent/dashboard");
  });

  it("lets a tenant reach the in-app plan page to buy or renew", () => {
    expect(hrefs).toContain("/paket");
  });

  it("lets a tenant reach their Nerona billing history", () => {
    expect(hrefs).toContain("/finance");
  });

  it("has no duplicate destinations", () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("keeps the tenant's own shop separate from Nerona billing", () => {
    const shop = TENANT_NAV.find((s) => s.title === "Toko");
    const billing = TENANT_NAV.find((s) => s.title === "Akun & Tagihan");
    expect(shop?.items.map((i) => i.href)).toEqual(["/produk", "/transaksi"]);
    expect(billing?.items.map((i) => i.href)).toEqual(["/paket", "/finance"]);
  });
});

describe("admin navigation", () => {
  const hrefs = flatten(ADMIN_NAV).map((item) => item.href);

  it("reaches every admin page", () => {
    expect(hrefs).toEqual([
      "/admin",
      "/admin/users",
      "/admin/orders",
      "/admin/pengaturan",
    ]);
  });

  it("has no duplicate destinations", () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("marketing navigation", () => {
  const hrefs = MARKETING_NAV.map((item) => item.href);

  it("gives guests a pricing path from every marketing page", () => {
    expect(hrefs).toContain("/pricing");
  });

  it("omits Home — the logo is the home link", () => {
    expect(hrefs).not.toContain("/");
  });
});

describe("sidebar glyphs", () => {
  /**
   * Between sm and xl the sidebar is a 56px icon strip with no labels, so a
   * misspelled icon name renders nothing at all — and stays invisible in
   * testing because the label covers for it at xl and above.
   */
  it("gives every sidebar item a glyph that exists", () => {
    for (const item of [...flatten(TENANT_NAV), ...flatten(ADMIN_NAV)]) {
      expect(ICON_NAMES).toContain(item.icon);
    }
  });
});

describe("activeHref", () => {
  const tenant = flatten(TENANT_NAV);

  it("prefers the longest match so sub-pages do not highlight the parent", () => {
    expect(activeHref("/agent/chat", tenant)).toBe("/agent/chat");
    expect(activeHref("/agent/dashboard", tenant)).toBe("/agent/dashboard");
    expect(activeHref("/dashboard", tenant)).toBe("/dashboard");
  });

  it("highlights a section item on its own sub-routes", () => {
    expect(activeHref("/produk/123", tenant)).toBe("/produk");
  });

  it("does not let /admin stay highlighted on /admin/users", () => {
    expect(activeHref("/admin/users", flatten(ADMIN_NAV))).toBe("/admin/users");
  });

  it("returns null when nothing matches", () => {
    expect(activeHref("/pricing", tenant)).toBeNull();
  });
});

describe("pageTitle", () => {
  it("names the active nav item", () => {
    expect(pageTitle("/finance", TENANT_NAV)).toBe("Finance");
    expect(pageTitle("/agent/dashboard", TENANT_NAV)).toBe("Koneksi WhatsApp");
  });

  it("names app pages that are deliberately absent from the sidebar", () => {
    expect(pageTitle("/profile", TENANT_NAV)).toBe("Profile");
    expect(pageTitle("/order/abc123", TENANT_NAV)).toBe("Order");
  });

  it("falls back to the brand name for anything unmapped", () => {
    expect(pageTitle("/totally-unknown", TENANT_NAV)).toBe("Nerona");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/tenant-nav.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/ui/icons"`.

- [ ] **Step 3: Create `src/components/ui/icons.tsx`**

`users`, `key`, `chat`, and `clock` are lifted verbatim from `src/app/(admin)/admin/page.tsx:9-29`. The other eight are the Feather glyphs the sidebar needs, in the same house style: 24px viewBox, `stroke="currentColor"`, `strokeWidth={2}`, round caps.

```tsx
const ICONS = {
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  key: (
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  ),
  chat: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  chart: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </>
  ),
  receipt: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  tag: (
    <>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </>
  ),
  wallet: (
    <>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </>
  ),
  settings: (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

// Exported as a plain array so tests can assert a nav item's icon exists —
// between sm and xl the sidebar shows no labels, so a typo renders nothing.
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "h-[18px] w-[18px]"}
    >
      {ICONS[name]}
    </svg>
  );
}
```

- [ ] **Step 4: Write `src/lib/nav.ts`**

`activeHref` and its `matches` helper are moved verbatim from `src/components/layout/HeaderNav.tsx:13-27`. The longest-match behavior is already correct; do not "improve" it.

This file must contain **no JSX** — `vitest` runs it in a node environment. That is why the icon is a string key and `IconName` comes in as a type-only import, which the transpiler erases entirely.

```ts
import type { IconName } from "@/components/ui/icons";

export type NavItem = { href: string; label: string };
// Sidebar items carry a glyph for the collapsed 56px strip. Requiring it here
// means an item with no icon cannot compile into a sidebar section.
export type SidebarItem = NavItem & { icon: IconName };
export type NavSection = { title?: string; items: SidebarItem[] };

// Public marketing pages. Text-only — that is why NavItem stays separate from
// SidebarItem. "Home" is deliberately absent — the logo is the
// home link. "Harga" is back after plan 2026-07-19 dropped it from the top
// nav: that decision relied on an in-page PricingTeaser component which no
// longer exists, leaving /metadata and /agent with no pricing path at all.
export const MARKETING_NAV: NavItem[] = [
  { href: "/agent", label: "Agent" },
  { href: "/metadata", label: "Metadata" },
  { href: "/pricing", label: "Harga" },
];

// The tenant app sidebar. "Toko" is the tenant's OWN shop — products they
// sell and orders they receive. "Akun & Tagihan" is their billing
// relationship with Nerona. The old flat CUSTOMER_NAV put /transaksi and
// /finance side by side, which read as one thing; keeping them apart is the
// point of this grouping.
export const TENANT_NAV: NavSection[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: "chart" }] },
  {
    title: "Agent",
    items: [
      { href: "/agent/chat", label: "Chat", icon: "chat" },
      { href: "/agent/dashboard", label: "Koneksi WhatsApp", icon: "link" },
    ],
  },
  {
    title: "Toko",
    items: [
      { href: "/produk", label: "Produk", icon: "box" },
      { href: "/transaksi", label: "Transaksi", icon: "receipt" },
    ],
  },
  {
    title: "Akun & Tagihan",
    items: [
      { href: "/paket", label: "Paket & Harga", icon: "tag" },
      { href: "/finance", label: "Finance", icon: "wallet" },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: "chart" }] },
  {
    title: "Kelola",
    items: [
      { href: "/admin/users", label: "Pengguna", icon: "users" },
      { href: "/admin/orders", label: "Order", icon: "receipt" },
    ],
  },
  {
    title: "Sistem",
    items: [{ href: "/admin/pengaturan", label: "Pengaturan", icon: "settings" }],
  },
];

// App pages reachable from inside the shell but deliberately kept out of the
// sidebar: /profile lives in the account dropdown, and the order flow is
// entered from /paket. They still need a topbar label.
const TITLE_OVERRIDES: NavItem[] = [
  { href: "/order", label: "Order" },
  { href: "/profile", label: "Profile" },
  { href: "/account", label: "Profile" },
];

export function flatten(sections: NavSection[]): SidebarItem[] {
  return sections.flatMap((section) => section.items);
}

function matches(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) || href === "/";
}

// The active item is the longest matching href, so "/admin" doesn't stay
// highlighted on "/admin/users" and "/" only wins when nothing else matches.
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (matches(pathname, item.href) && (best === null || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

// Label for the app topbar. Rendered as a locator, never as a heading — the
// pages own their <h1>.
export function pageTitle(pathname: string, sections: NavSection[]): string {
  const items = [...flatten(sections), ...TITLE_OVERRIDES];
  const active = activeHref(pathname, items);
  return items.find((item) => item.href === active)?.label ?? "Nerona";
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd nerona-web && npx vitest run tests/lib/tenant-nav.test.ts`
Expected: PASS, all cases including `sidebar glyphs`.

- [ ] **Step 6: Point the admin dashboard at the shared icon module**

In `src/app/(admin)/admin/page.tsx`, delete the private `ICONS` map (lines 9-29) and reduce `IconChip` (lines 39-56) to use the shared component. `CHIP_TONES` and `StatTile` stay as they are.

```tsx
import { Icon, type IconName } from "@/components/ui/icons";

function IconChip({ tone, icon }: { tone: keyof typeof CHIP_TONES; icon: IconName }) {
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${CHIP_TONES[tone]}`}>
      <Icon name={icon} />
    </span>
  );
}
```

`StatTile`'s prop type at line 67 is `icon: keyof typeof ICONS` — change it to `icon: IconName`. The four call sites (`users`, `key`, `chat`, `clock`) need no edits because those glyphs kept their names.

- [ ] **Step 7: Run the whole suite and lint**

Run: `cd nerona-web && npm test && npm run lint`
Expected: all pass. `Header.tsx` still exports `CUSTOMER_NAV` and `HeaderNav.tsx` still exports `activeHref`; nothing imports them from the test any more, but they remain valid until Task 5 deletes them.

- [ ] **Step 8: Commit**

```bash
cd nerona-web
git add src/lib/nav.ts src/components/ui/icons.tsx \
        "src/app/(admin)/admin/page.tsx" tests/lib/tenant-nav.test.ts
git commit -m "feat: add lib/nav.ts and a shared icon set as the nav's data

Sectioned TENANT_NAV/ADMIN_NAV plus MARKETING_NAV, with activeHref moved
verbatim out of HeaderNav.tsx and a pageTitle helper for the app topbar.
Every sidebar item carries a glyph, because between sm and xl the sidebar
is a 56px icon strip with no labels.

ICONS moves out of admin/page.tsx into components/ui/icons.tsx and gains
the eight glyphs the sidebar needs.

Closes the third instance of the bug tenant-nav.test.ts guards:
/agent/dashboard was reachable from no nav array."
```

---

### Task 3: `src/lib/auth-redirect.ts` — where to land after sign-in

**Files:**
- Create: `src/lib/auth-redirect.ts`
- Create: `tests/lib/auth-redirect.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, imported by Task 5 (`MarketingHeader`) and Task 6 (`post-login`, `(auth)/layout.tsx`):
  - `homeForRole(user: { role?: string | null }): string`
  - `safeCallbackUrl(raw: string | null | undefined): string | null`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/auth-redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { homeForRole, safeCallbackUrl } from "@/lib/auth-redirect";

describe("homeForRole", () => {
  it("sends an admin to the admin dashboard", () => {
    expect(homeForRole({ role: "support" })).toBe("/admin");
  });

  it("sends a tenant to their shop dashboard", () => {
    expect(homeForRole({ role: null })).toBe("/dashboard");
  });

  it("treats a missing role as a tenant", () => {
    expect(homeForRole({})).toBe("/dashboard");
  });
});

describe("safeCallbackUrl", () => {
  it("accepts a same-origin absolute path", () => {
    expect(safeCallbackUrl("/admin/users")).toBe("/admin/users");
  });

  it("keeps the query string on an accepted path", () => {
    expect(safeCallbackUrl("/transaksi?page=2")).toBe("/transaksi?page=2");
  });

  it("rejects a protocol-relative URL disguised as a path", () => {
    // A naive startsWith("/") check would hand this straight to evil.com.
    expect(safeCallbackUrl("//evil.com")).toBeNull();
  });

  it("rejects a backslash-escaped protocol-relative URL", () => {
    expect(safeCallbackUrl("/\\evil.com")).toBeNull();
  });

  it("rejects an absolute URL to another origin", () => {
    expect(safeCallbackUrl("https://evil.com")).toBeNull();
  });

  it("rejects a relative path with no leading slash", () => {
    expect(safeCallbackUrl("dashboard")).toBeNull();
  });

  it("rejects pointing back at the landing route, which would loop", () => {
    expect(safeCallbackUrl("/post-login")).toBeNull();
    expect(safeCallbackUrl("/post-login?next=%2Fpost-login")).toBeNull();
  });

  it("rejects empty and missing input", () => {
    expect(safeCallbackUrl("")).toBeNull();
    expect(safeCallbackUrl(null)).toBeNull();
    expect(safeCallbackUrl(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/auth-redirect.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth-redirect"`.

- [ ] **Step 3: Write `src/lib/auth-redirect.ts`**

```ts
// Where a user belongs immediately after signing in. Admins have no personal
// tenant dashboard, so sending them to /dashboard lands them on a page whose
// nav does not even contain it.
export function homeForRole(user: { role?: string | null }): string {
  return user.role ? "/admin" : "/dashboard";
}

// Only same-origin absolute paths survive.
//
// "//evil.com" and "/\evil.com" are read by browsers as protocol-relative
// URLs pointing at another host, so a startsWith("/") check on its own is an
// open redirect. "/post-login" is refused separately because feeding the
// landing route back to itself can loop.
export function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw === "/post-login" || raw.startsWith("/post-login?")) return null;
  return raw;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd nerona-web && npx vitest run tests/lib/auth-redirect.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
cd nerona-web
git add src/lib/auth-redirect.ts tests/lib/auth-redirect.test.ts
git commit -m "feat: add auth-redirect helpers for role-aware post-login landing

safeCallbackUrl refuses protocol-relative paths (//evil.com, /\\evil.com)
that a startsWith('/') check would let through as an open redirect."
```

---

### Task 4: Marketing shell

**Files:**
- Create: `src/components/layout/MarketingHeader.tsx` (server)
- Create: `src/components/layout/MarketingNavLinks.tsx` (client)
- Create: `src/app/(marketing)/layout.tsx`
- Modify: `src/components/layout/Footer.tsx` — drop the signed-in `null` guard, swap the `Masuk` link for `Dashboard` when a session exists
- Do NOT touch: `src/app/layout.tsx` (Task 5 strips it), `Header.tsx`, `HeaderNav.tsx`

**Interfaces:**
- Consumes: `MARKETING_NAV`, `NavItem`, `activeHref` from `@/lib/nav` (Task 2); `homeForRole` from `@/lib/auth-redirect` (Task 3).
- Produces: `MarketingHeader` (async server component, no props) — used only by `(marketing)/layout.tsx`.

Because the root layout still renders `Header` in this task, marketing pages will briefly show **two** headers. That is expected and is resolved in Task 5. Verify this task by build + lint, not by eyeballing the page.

- [ ] **Step 1: Create `src/components/layout/MarketingNavLinks.tsx`**

The desktop/mobile structure and every Tailwind class here is lifted from `HeaderNav.tsx:80-144` so the marketing header looks identical to today's guest header. What changes: no sign-out modal, no points chip, and a two-part auth area.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { activeHref, type NavItem } from "@/lib/nav";

export function MarketingNavLinks({
  items,
  dashboardHref,
}: {
  items: NavItem[];
  dashboardHref: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname, items);

  // Signed-in visitors keep full access to the marketing pages — /pricing is
  // where tenants buy points — so the auth area becomes a way back in rather
  // than a redirect.
  const authArea = dashboardHref ? (
    <Link
      href={dashboardHref}
      className="rounded-full bg-navy-900/5 px-3.5 py-1.5 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
    >
      Dashboard →
    </Link>
  ) : (
    <>
      <Link href="/login" className="text-xs text-ink transition hover:text-brand-blue">
        Masuk
      </Link>
      <Link
        href="/register"
        className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition hover:brightness-110"
      >
        Coba Gratis
      </Link>
    </>
  );

  return (
    <>
      <nav className="hidden items-center gap-7 sm:flex">
        {items.map((item) => {
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`text-xs text-ink transition hover:text-brand-blue ${
                isActive ? "-mb-px border-b-2 border-brand-blue pb-px font-semibold" : ""
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {authArea}
      </nav>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/5 sm:hidden"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          {open ? "✕" : "☰"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-12 border-b border-navy-900/10 bg-canvas/95 shadow-lg shadow-navy-900/10 backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={item.href === active ? "page" : undefined}
                className={`rounded-lg px-2 py-2 text-sm text-ink transition hover:bg-navy-900/5 ${
                  item.href === active ? "bg-navy-900/5 font-semibold" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-navy-900/10 pt-3">
              {authArea}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `src/components/layout/MarketingHeader.tsx`**

```tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";
import { MARKETING_NAV } from "@/lib/nav";
import { MarketingNavLinks } from "@/components/layout/MarketingNavLinks";

export async function MarketingHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-navy-900/10 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"
        >
          <img src="/logo-nerona.svg" alt="" className="h-5 w-5" />
          Nerona
        </Link>
        <MarketingNavLinks
          items={MARKETING_NAV}
          dashboardHref={session?.user ? homeForRole(session.user) : null}
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create `src/app/(marketing)/layout.tsx`**

The `flex min-h-screen flex-col` wrapper moves here from `src/app/layout.tsx:19`, so the footer still sits at the bottom on short pages.

```tsx
import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { Footer } from "@/components/layout/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Update `src/components/layout/Footer.tsx`**

The footer now renders only on marketing pages, so the "hide when signed in" guard at lines 17-19 is obsolete. But signed-in users will now *see* it on `/` and `/pricing`, where a "Masuk" link makes no sense — so that entry becomes role-aware.

Replace lines 7-19 with:

```tsx
const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/agent", label: "Agent" },
  { href: "/metadata", label: "Metadata" },
  { href: "/pricing", label: "Harga" },
];

export async function Footer() {
  const session = await getServerSession(authOptions);
  // Signed-in visitors now see the footer on marketing pages, where a
  // "Masuk" link is nonsense — point them back into the app instead.
  const links = session?.user
    ? [...FOOTER_LINKS, { href: homeForRole(session.user), label: "Dashboard" }]
    : [...FOOTER_LINKS, { href: "/login", label: "Masuk" }];
```

Then change the `.map` at line 32 to iterate `links` instead of `FOOTER_LINKS`, and add the import:

```tsx
import { homeForRole } from "@/lib/auth-redirect";
```

- [ ] **Step 5: Build and lint**

Run: `cd nerona-web && npm run build && npm run lint`
Expected: both pass. Marketing pages now render two headers (root `Header` plus `MarketingHeader`) — correct for this intermediate state.

- [ ] **Step 6: Commit**

```bash
cd nerona-web
git add src/components/layout/MarketingHeader.tsx \
        src/components/layout/MarketingNavLinks.tsx \
        src/components/layout/Footer.tsx \
        "src/app/(marketing)/layout.tsx"
git commit -m "feat: add the marketing shell

MarketingHeader drops the Home item (the logo is the home link), restores
Harga to the top nav, and splits auth into a Masuk text link plus a Coba
Gratis CTA. Signed-in visitors get 'Dashboard →' instead, in header and
footer both — /pricing stays reachable because that is where tenants buy."
```

---

### Task 5: App shell, and retire the shared header

This is the task that makes the split real. At its end there is exactly one shell per page.

**Files:**
- Create: `src/components/layout/AppSidebar.tsx` (client)
- Create: `src/components/layout/AccountMenu.tsx` (client)
- Create: `src/components/layout/AppShell.tsx` (client)
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(admin)/layout.tsx`
- Delete: `src/app/(admin)/admin/layout.tsx` — its guard, container, and `<main>` all move up into `(admin)/layout.tsx`
- Modify: `src/app/layout.tsx` — strip to `<html>`/`<body>`
- Delete: `src/components/layout/Header.tsx`, `src/components/layout/HeaderNav.tsx`

**Interfaces:**
- Consumes: `TENANT_NAV`, `ADMIN_NAV`, `NavSection`, `activeHref`, `flatten`, `pageTitle` from `@/lib/nav`; `Icon` from `@/components/ui/icons`; `requireUser`/`requireAdmin` from `@/lib/session-guards`; `getBalance` from `@/lib/points`; `Modal` from `@/components/ui/Modal`.
- Produces:
  - `AppSidebar({ sections, showLabels, onNavigate }: { sections: NavSection[]; showLabels?: boolean; onNavigate?: () => void })`
  - `AccountMenu({ email }: { email: string })`
  - `AppShell({ sections, points, email, homeHref, children }: { sections: NavSection[]; points: number | null; email: string; homeHref: string; children: React.ReactNode })`

`AppShell` is a client component taking only serializable props plus `children`; the two group layouts stay server components and do the data fetching.

`AppSidebar`'s `showLabels` prop is what makes the collapse work. It is **not** a boolean the caller computes from a window width — the strip and the labelled sidebar are two renders of the same component, selected by Tailwind's `hidden`/`xl:block` on their containers, so there is no JavaScript width measurement and no hydration mismatch:

- `showLabels` omitted → the 56px icon strip (`sm` to `xl`)
- `showLabels` → the labelled sidebar (the `xl` rail and the mobile drawer, both of which have room)

- [ ] **Step 1: Create `src/components/layout/AppSidebar.tsx`**

Two things carry the label when it is hidden: `title` (hover tooltip) and `aria-label` (screen readers). Both are always set, so the labelled variant is unharmed by them.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, flatten, type NavSection } from "@/lib/nav";
import { Icon } from "@/components/ui/icons";

export function AppSidebar({
  sections,
  showLabels,
  onNavigate,
}: {
  sections: NavSection[];
  showLabels?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname, flatten(sections));

  return (
    <nav className={`flex flex-col gap-4 py-4 ${showLabels ? "px-3" : "px-2"}`}>
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {section.title &&
            (showLabels ? (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                {section.title}
              </p>
            ) : (
              // "AKUN & TAGIHAN" cannot fit 56px, so the grouping survives as
              // a rule instead of a caption.
              <hr className="mx-2 mb-2 border-navy-900/10" />
            ))}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const isActive = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center rounded-lg transition ${
                      showLabels ? "gap-2.5 px-2 py-1.5" : "h-10 w-10 justify-center"
                    } ${
                      isActive
                        ? "bg-brand-blue/10 font-semibold text-ink"
                        : "text-muted hover:bg-navy-900/5 hover:text-ink"
                    }`}
                  >
                    <Icon name={item.icon} className="h-[18px] w-[18px] flex-none" />
                    {showLabels && <span className="truncate text-sm">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/components/layout/AccountMenu.tsx`**

The sign-out confirmation flow — state, handler, and `Modal` markup — is moved from `HeaderNav.tsx:38-47` and `147-169` with its copy unchanged.

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function handleSignOut() {
    setSigningOut(true);
    signOut({ callbackUrl: "/" });
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu akun"
          aria-expanded={open}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900/5 text-xs font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
        >
          {initial}
        </button>

        {open && (
          <>
            {/* Click-away catcher — the dropdown is small enough not to need
                focus trapping, but it must not stay open behind a navigation. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl bg-surface shadow-lg shadow-navy-900/15 ring-1 ring-navy-900/10">
              <p className="truncate border-b border-navy-900/10 px-3 py-2 text-xs text-muted">
                {email}
              </p>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-ink transition hover:bg-navy-900/5"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmOpen(true);
                }}
                className="block w-full border-t border-navy-900/10 px-3 py-2 text-left text-sm text-ink transition hover:bg-navy-900/5"
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Keluar dari akun?">
        <p className="text-sm leading-relaxed text-muted">
          Anda akan keluar dari akun Nerona di perangkat ini. Anda bisa masuk kembali kapan saja.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            disabled={signingOut}
            className="rounded-full bg-navy-900/5 px-4 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
          >
            {signingOut ? "Keluar..." : "Ya, keluar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Create `src/components/layout/AppShell.tsx`**

Three things here are load-bearing and must not be "simplified":

1. **`<div className="min-w-0 flex-1">` around `children`, not `<main>`.** Every tenant page brings its own `<main>`.
2. **The title is a `<span>`, not a heading.** The pages own their `<h1>`.
3. **Two `<aside>` rails, selected by Tailwind, not by JavaScript.** The 56px strip is `hidden sm:block xl:hidden`; the 224px rail is `hidden xl:block`. Measuring `window.innerWidth` instead would break server rendering and flash the wrong width on load. The `w-14` on the strip is the number the whole responsive design rests on — see the Global Constraints.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pageTitle, type NavSection } from "@/lib/nav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";

export function AppShell({
  sections,
  points,
  email,
  homeHref,
  children,
}: {
  sections: NavSection[];
  points: number | null;
  email: string;
  homeHref: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const title = pageTitle(pathname, sections);

  // The wordmark only appears where there is room for it; the 56px strip gets
  // the logo mark alone, centered.
  const brand = (withWordmark: boolean) => (
    <Link
      href={homeHref}
      title="Nerona"
      className={`flex h-12 flex-none items-center text-sm font-semibold tracking-tight text-ink ${
        withWordmark ? "gap-2 px-5" : "justify-center"
      }`}
    >
      <img src="/logo-nerona.svg" alt="" className="h-5 w-5 flex-none" />
      {withWordmark && "Nerona"}
    </Link>
  );

  const pointsChip =
    points != null ? (
      <Link
        href="/finance"
        title="Saldo poin — lihat riwayat di Finance"
        className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-semibold text-[#9A6B08] ring-1 ring-gold-400/40 transition hover:bg-gold-400/30"
      >
        {points.toLocaleString("id-ID")} poin
      </Link>
    ) : null;

  const rail = "flex-none border-r border-navy-900/10 bg-surface/60";
  const railInner = "sticky top-0 flex h-screen flex-col";

  return (
    <div className="flex min-h-screen">
      {/* sm → xl: the 56px icon strip. w-14 is what keeps every lg: grid in
          the app working — see the Global Constraints. */}
      <aside className={`hidden w-14 sm:block xl:hidden ${rail}`}>
        <div className={railInner}>
          {brand(false)}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppSidebar sections={sections} />
          </div>
        </div>
      </aside>

      {/* xl and up: the full sidebar with labels and section headers. */}
      <aside className={`hidden w-56 xl:block ${rail}`}>
        <div className={railInner}>
          {brand(true)}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppSidebar sections={sections} showLabels />
          </div>
        </div>
      </aside>

      {/* Below sm: a drawer. An overlay has room, so it always shows labels. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-navy-900/10 bg-canvas">
            {brand(true)}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AppSidebar
                sections={sections}
                showLabels
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 flex-none items-center justify-between gap-3 border-b border-navy-900/10 bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/5 sm:hidden"
            >
              <span className="text-lg leading-none" aria-hidden="true">
                ☰
              </span>
            </button>
            {/* A locator, not a heading — the page below owns the <h1>. */}
            <span className="truncate text-sm font-medium text-ink">{title}</span>
          </div>
          <div className="flex flex-none items-center gap-2">
            {pointsChip}
            <AccountMenu email={email} />
          </div>
        </header>

        {/* Not <main> — every tenant page supplies its own. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/(app)/layout.tsx`**

`getBalance` on every app render matches what `Header.tsx:42` already did, so this is not a new query.

```tsx
import { requireUser } from "@/lib/session-guards";
import { getBalance } from "@/lib/points";
import { TENANT_NAV } from "@/lib/nav";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const points = await getBalance(session.user.id);

  return (
    <AppShell
      sections={TENANT_NAV}
      points={points}
      email={session.user.email ?? ""}
      homeHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 5: Create `src/app/(admin)/layout.tsx` and collapse the old admin layout**

Admins have no personal wallet, so `points` is `null` — matching the tenant-only rule at `Header.tsx:42`. Admin pages supply neither `<main>` nor a container, so this layout keeps the `mx-auto max-w-6xl px-6 py-12` from the old `admin/layout.tsx:8` and supplies the `<main>`.

Create `src/app/(admin)/layout.tsx`:

```tsx
import { requireAdmin } from "@/lib/session-guards";
import { ADMIN_NAV } from "@/lib/nav";
import { AppShell } from "@/components/layout/AppShell";

export default async function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <AppShell
      sections={ADMIN_NAV}
      points={null}
      email={session.user.email ?? ""}
      homeHref="/admin"
    >
      {/* Admin pages bring no <main> and no container of their own. */}
      <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
    </AppShell>
  );
}
```

Then delete `src/app/(admin)/admin/layout.tsx`. Its `requireAdmin()` guard is now in the group layout, its `<h1>Admin</h1>` is replaced by the topbar section name, and its `{email} · {role}` line is replaced by `AccountMenu`.

```bash
cd nerona-web && git rm "src/app/(admin)/admin/layout.tsx"
```

- [ ] **Step 6: Strip `src/app/layout.tsx` to the document shell**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Nerona",
  description:
    "Alat AI Nerona — metadata otomatis untuk kontributor stock, dan asisten AI WhatsApp untuk pemilik bisnis.",
};

// Chrome lives in the route group layouts: (marketing) has the topbar and
// footer, (app) and (admin) have the sidebar shell, (auth) has none.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Delete the retired shared header**

```bash
cd nerona-web
git rm src/components/layout/Header.tsx src/components/layout/HeaderNav.tsx
```

- [ ] **Step 8: Verify nothing still imports them**

Run: `cd nerona-web && grep -rn "layout/Header\|CUSTOMER_NAV\|HeaderNav" src tests`
Expected: no matches. If `tests/lib/tenant-nav.test.ts` still appears, Task 2 Step 1 was not applied.

- [ ] **Step 9: Build, test, lint**

Run: `cd nerona-web && npm run build && npm test && npm run lint`
Expected: all pass. `(auth)` pages render bare — no header at all — which is correct; Task 6 adds their layout guard.

- [ ] **Step 10: Commit**

```bash
cd nerona-web
git add -A src/app src/components/layout
git commit -m "feat: add the app sidebar shell and retire the shared header

Nine tenant pages plus a points chip plus Sign Out no longer have to fit
one h-12 bar. Sections keep the tenant's own shop apart from their Nerona
billing, and /agent/dashboard finally has a nav entry.

The sidebar collapses to a 56px icon strip between sm and xl. That width
is chosen, not arbitrary: a fixed 224px rail leaves a stat card 176px at
1024px, and 'Rp 4.250.000' at text-2xl needs ~165px in 136px of padded
room. The strip gives 218px/178px, so all six lg: grids in the app keep
working with no class changes.

(admin) is a sibling group, not a child of (app) — nesting would wrap
admin pages in the tenant sidebar and the admin sidebar both."
```

---

### Task 6: Honor `callbackUrl` and land users by role

**Files:**
- Create: `src/app/post-login/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Modify: `src/middleware.ts` — add `x-pathname` beside the existing `x-nonce`
- Modify: `src/lib/session-guards.ts` — carry the intended path into `callbackUrl`; send non-admins to `/dashboard`
- Modify: `src/app/(auth)/login/page.tsx:34` — route through `/post-login`
- Modify: `src/components/auth/GoogleButton.tsx:31` — route through `/post-login`
- Modify: `tests/lib/session-guards.test.ts` — `/profile` becomes `/dashboard`; cover the `callbackUrl` pass-through

**Interfaces:**
- Consumes: `homeForRole`, `safeCallbackUrl` from `@/lib/auth-redirect` (Task 3); `requireUser` from `@/lib/session-guards`.
- Produces: the `/post-login` route. No exported symbols.

- [ ] **Step 1: Write the failing test**

Replace the contents of `tests/lib/session-guards.test.ts`. The `next/headers` mock is new — `requireUser` now reads the path the middleware recorded.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const headerMock = vi.fn(() => null as string | null);

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("next/headers", () => ({
  // requireUser only ever asks for x-pathname, so the key is not asserted.
  headers: () => ({ get: () => headerMock() }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { requireAdmin, requireUser } from "@/lib/session-guards";

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headerMock.mockReturnValue(null);
  });

  it("redirects to sign-in when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("carries the intended path so the deep link survives sign-in", async () => {
    getServerSessionMock.mockResolvedValue(null);
    headerMock.mockReturnValue("/transaksi");

    await expect(requireUser()).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=%2Ftransaksi"
    );
  });

  it("ignores an off-origin path the header should never contain", async () => {
    getServerSessionMock.mockResolvedValue(null);
    headerMock.mockReturnValue("//evil.com");

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("returns the session when signed in", async () => {
    const session = { user: { id: "u1", role: null } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireUser()).resolves.toBe(session);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headerMock.mockReturnValue(null);
  });

  it("sends a non-admin to their own dashboard", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("returns the session when the user has an admin role", async () => {
    const session = { user: { id: "u1", role: "support" } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireAdmin()).resolves.toBe(session);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd nerona-web && npx vitest run tests/lib/session-guards.test.ts`
Expected: FAIL — the `callbackUrl` case gets `REDIRECT:/login`, and the non-admin case gets `REDIRECT:/profile`.

- [ ] **Step 3: Update `src/lib/session-guards.ts`**

```ts
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { safeCallbackUrl } from "./auth-redirect";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    // src/middleware.ts records the request path as x-pathname, the same way
    // it passes the CSP nonce through. Without it the intended destination is
    // lost and every sign-in lands on the default home.
    const intended = safeCallbackUrl(headers().get("x-pathname"));
    redirect(intended ? `/login?callbackUrl=${encodeURIComponent(intended)}` : "/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!session.user.role) {
    redirect("/dashboard");
  }
  return session;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd nerona-web && npx vitest run tests/lib/session-guards.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Add `x-pathname` in `src/middleware.ts`**

Beside the existing `x-nonce` line (currently line 64):

```ts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Server components cannot read the request path. requireUser() needs it to
  // build ?callbackUrl= so a deep link survives sign-in.
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", csp);
```

- [ ] **Step 6: Create `src/app/post-login/page.tsx`**

This must live at `src/app/post-login/`, **outside `(auth)`**. Inside it, the `(auth)` layout added in Step 7 would redirect signed-in users to their role home before this page could read `next`.

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session-guards";
import { homeForRole, safeCallbackUrl } from "@/lib/auth-redirect";

// One landing point shared by credentials sign-in and Google OAuth. Both used
// to hardcode /dashboard, which discarded the callbackUrl the middleware sets
// and dropped admins onto a tenant page.
export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const session = await requireUser();

  // A repeated query parameter arrives as string[]; "?next=/a&next=//evil.com"
  // must not slip past a check written for a plain string.
  const next = typeof searchParams.next === "string" ? searchParams.next : null;
  redirect(safeCallbackUrl(next) ?? homeForRole(session.user));
}
```

- [ ] **Step 7: Create `src/app/(auth)/layout.tsx`**

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";

// No chrome: the auth pages are self-contained cards. A signed-in visitor has
// no business on /login or /register, so send them where they belong.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(homeForRole(session.user));
  }
  return <>{children}</>;
}
```

Note `verify-email` and `reset-password` live in this group too, and a signed-in user hitting them will now be redirected. That is intended: both flows are entered from an email link while signed out.

- [ ] **Step 8: Route the credentials login through `/post-login`**

In `src/app/(auth)/login/page.tsx`, the `useSearchParams()` hook already exists at line 13 but only reads `"error"`. Read `callbackUrl` too, and replace the hardcoded push at line 34:

```tsx
    const callbackUrl = searchParams.get("callbackUrl");
    router.push(
      callbackUrl
        ? `/post-login?next=${encodeURIComponent(callbackUrl)}`
        : "/post-login"
    );
```

Keep `redirect: false` on the `signIn` call at line 26 — the inline "Email atau kata sandi salah" handling at lines 28-32 depends on it.

- [ ] **Step 9: Route Google sign-in through `/post-login`**

`src/components/auth/GoogleButton.tsx` is rendered inside the login page, so give it the same `next` the form uses. Change the component to accept it:

```tsx
export function GoogleButton({ callbackUrl }: { callbackUrl?: string | null }) {
  const next = callbackUrl
    ? `/post-login?next=${encodeURIComponent(callbackUrl)}`
    : "/post-login";
  return (
    <AuthButton variant="secondary" onClick={() => signIn("google", { callbackUrl: next })}>
      <span className="flex items-center justify-center gap-2.5">
        <GoogleLogo />
        Lanjutkan dengan Google
      </span>
    </AuthButton>
  );
}
```

Then in `src/app/(auth)/login/page.tsx`, change `<GoogleButton />` at line 64 to:

```tsx
      <GoogleButton callbackUrl={searchParams.get("callbackUrl")} />
```

Check whether `GoogleButton` is used anywhere else and leave those call sites alone — the prop is optional and defaults to a bare `/post-login`:

Run: `cd nerona-web && grep -rn "GoogleButton" src`

- [ ] **Step 10: Build, test, lint**

Run: `cd nerona-web && npm run build && npm test && npm run lint`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
cd nerona-web
git add -A src tests
git commit -m "feat: honor callbackUrl and land users by role after sign-in

Both sign-in paths hardcoded /dashboard, discarding the callbackUrl the
middleware sets and dropping admins onto a tenant page whose nav does not
contain it. One /post-login route now decides for both.

/post-login sits outside (auth) on purpose: the group layout's
signed-in redirect would otherwise swallow the next parameter."
```

---

### Task 7: `/paket` — buy and renew inside the app shell

**Files:**
- Create: `src/app/(app)/paket/page.tsx`
- Modify: `src/app/(app)/finance/page.tsx:141-145` — replace the "Hubungi admin" dead end with a link to `/paket`
- Modify: `src/app/(marketing)/pricing/page.tsx` — hand signed-in visitors over to `/paket`

**Interfaces:**
- Consumes: `requireUser` from `@/lib/session-guards`; `metadataTiers`/`agentTiers` from `@/lib/pricing-tiers`; `PricingSwitcher` from `@/components/marketing/PricingSwitcher`; `getBalance` from `@/lib/points`.
- Produces: the `/paket` route, already asserted by Task 2's test.

- [ ] **Step 1: Create `src/app/(app)/paket/page.tsx`**

`PricingSwitcher` is a client component whose only prop is `products` (`PricingSwitcher.tsx:17`), so this reuses it against the same data source as `/pricing` with nothing duplicated. Deliberately **not** carried over: the hero, `StepsSection`, `FaqSection`, and `CtaBanner` — that banner's CTA is "Buat akun gratis" → `/register`, which is meaningless for a signed-in user.

```tsx
import { requireUser } from "@/lib/session-guards";
import { getBalance } from "@/lib/points";
import { PricingSwitcher } from "@/components/marketing/PricingSwitcher";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";

export const metadata = { title: "Paket & Harga — Nerona" };

export default async function PaketPage() {
  const session = await requireUser();
  const [tiers, balance] = await Promise.all([
    metadataTiers(),
    getBalance(session.user.id),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Paket & Harga</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-3.5 py-1.5 text-sm font-semibold text-[#9A6B08] ring-1 ring-gold-400/40">
            {balance.toLocaleString("id-ID")} poin
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Pilih paket untuk membeli atau memperpanjang. Riwayat pembayaran ada di Finance.
        </p>

        <div className="mt-10">
          <PricingSwitcher
            products={[
              {
                key: "metadata",
                label: "🖼️ Metadata",
                subheading: "Metadata otomatis untuk kontributor stock.",
                tiers,
              },
              {
                key: "agent",
                label: "💬 Agent",
                subheading: "Asisten AI WhatsApp untuk pemilik bisnis.",
                tiers: agentTiers(),
              },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Replace the dead end in `src/app/(app)/finance/page.tsx`**

The "Poin" section header currently reads:

```tsx
          <h2 className="text-sm font-semibold text-ink">Poin</h2>
          <p className="mt-1 text-xs text-muted">
            Poin dipakai untuk balasan AI asisten WhatsApp. Hubungi admin untuk isi ulang.
          </p>
```

"Hubungi admin untuk isi ulang" is the dead end. Replace both lines with a header row carrying a real action:

```tsx
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Poin</h2>
            <Link
              href="/paket"
              className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition hover:brightness-110"
            >
              Beli / perpanjang paket
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted">
            Poin dipakai untuk balasan AI asisten WhatsApp.
          </p>
```

`Link` is already imported at line 1.

- [ ] **Step 3: Send signed-in visitors from `/pricing` to `/paket`**

A tenant must never sit on a purchase page without their sidebar, and `/pricing` cannot exist in both `(marketing)` and `(app)` — identical paths in two route groups is a build error. So the tenant gets their own path and `/pricing` hands them over.

The sidebar points at `/paket` directly, so this only catches stale entry points: the footer, bookmarks, search results, and the existing in-page links at `(marketing)/page.tsx:76` and `(app)/order/page.tsx:29,41`.

In `src/app/(marketing)/pricing/page.tsx`, add the imports:

```tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
```

Then open `PricingPage` — already an async component — with the handover, before `metadataTiers()` so a redirected tenant never pays for the query:

```tsx
export default async function PricingPage() {
  // /pricing is the one dual-audience page: marketing copy for visitors,
  // a purchase surface for tenants. A tenant buying points should have the
  // app sidebar, and one path cannot live in two route groups — so they get
  // /paket instead. Deliberately NOT applied to /, /agent, or /metadata:
  // those are pure marketing and are fine to read while signed in.
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/paket");
  }

  const tiers = await metadataTiers();
```

Leave the rest of the page — hero, `PricingSwitcher`, `StepsSection`, `FaqSection`, and the `CtaBanner` whose CTA is "Buat akun gratis" — exactly as it is. It is now unambiguously the guest view, so nothing in it needs to branch.

- [ ] **Step 4: Build, test, lint**

Run: `cd nerona-web && npm run build && npm test && npm run lint`
Expected: all pass, including Task 2's `expect(hrefs).toContain("/paket")`.

- [ ] **Step 5: Commit**

```bash
cd nerona-web
git add "src/app/(app)/paket/page.tsx" \
        "src/app/(app)/finance/page.tsx" \
        "src/app/(marketing)/pricing/page.tsx"
git commit -m "feat: add /paket so tenants buy and renew inside the app shell

Reuses PricingSwitcher against the same lib/pricing-tiers data as
/pricing, dropping the hero, steps, FAQ, and the 'Buat akun gratis' CTA
that makes no sense for a signed-in user. Replaces Finance's 'contact an
admin to top up' dead end.

/pricing now hands signed-in visitors to /paket: a tenant buying points
should have the app sidebar, and one path cannot live in two route
groups. Not applied to /, /agent, or /metadata — those are pure
marketing and fine to read while signed in."
```

---

## Final Verification

Run these after Task 7. Steps 4 onward are manual and need `npm run dev`.

- [ ] `cd nerona-web && npm run build` — succeeds; route list matches the paths from Task 1 Step 6, plus `/paket` and `/post-login`.
- [ ] `cd nerona-web && npm test` — all suites pass.
- [ ] `cd nerona-web && npm run lint` — clean.
- [ ] **Signed out, `/`:** top nav reads `Agent · Metadata · Harga`, then `Masuk` and a gold `Coba Gratis`. Footer present with a `Masuk` entry. No sidebar.
- [ ] **Signed out, `/metadata`:** `Harga` is in the top nav — the gap this plan closes.
- [ ] **Tenant, `/dashboard`:** sidebar with `Dashboard`, then `AGENT` (Chat, Koneksi WhatsApp), `TOKO` (Produk, Transaksi), `AKUN & TAGIHAN` (Paket & Harga, Finance). Topbar reads "Dashboard" small; the page's own `<h1>Dashboard</h1>` is still there below it. Points chip and avatar top right.
- [ ] **Tenant, click every sidebar item:** each resolves, and exactly one item is highlighted on each. On `/agent/chat` the `Chat` item highlights, not `Dashboard`.
- [ ] **Tenant, `/agent/dashboard`:** reachable from the sidebar as `Koneksi WhatsApp`, topbar shows that label.
- [ ] **Tenant, `/paket`:** both product tabs render tiers; the points chip shows the same balance as the topbar.
- [ ] **Tenant, `/finance`:** the Poin section links to `/paket` instead of telling the user to contact an admin.
- [ ] **Tenant, `/`:** marketing chrome, and the top-right button reads `Dashboard →`. Clicking it returns to `/dashboard`.
- [ ] **Tenant, `/pricing`:** lands on `/paket`, inside the sidebar shell. Check the footer's `Harga` link too — it goes through `/pricing` and must end up in the same place.
- [ ] **Signed out, `/pricing`:** still the full marketing page — hero, tiers, steps, FAQ, and the "Buat akun gratis" banner. The redirect must not fire for guests.
- [ ] **Tenant, avatar menu:** shows the email, `Profile`, and `Sign Out`. `Sign Out` opens the "Keluar dari akun?" confirmation and signing out lands on `/`.
- [ ] **Admin login:** lands on `/admin`, not `/dashboard`. Admin sidebar shows `Dashboard`, `KELOLA` (Pengguna, Order), `SISTEM` (Pengaturan). No points chip. No leftover `<h1>Admin</h1>` or `email · role` line.
- [ ] **Non-admin visiting `/admin`:** redirected to `/dashboard`, not `/profile`.
- [ ] **Deep link:** signed out, open `/admin/users` → login page → sign in as admin → land on `/admin/users`, not `/admin`.
- [ ] **Open redirect:** signed in, open `/post-login?next=//example.com` → lands on the role home and never leaves the origin. Repeat with `/post-login?next=/a&next=//example.com`.
- [ ] **Signed in, `/login`:** redirected to the role home.
- [ ] **< 640px, tenant:** no rail; hamburger opens the drawer with full labels and section headers; tapping a nav item navigates and closes it; points chip stays in the topbar.
- [ ] **~1024px, tenant `/dashboard`:** the 56px icon strip is showing — logo mark only, no wordmark, section groups separated by a rule instead of captions. Hovering a glyph shows its label. **The stat row is four columns and "Rp 4.250.000" sits on one line.** This is the regression the strip exists to prevent; if that figure wraps, the strip is wider than `w-14` or a grid class was edited.
- [ ] **~1024px, `/admin/users`:** the `min-w-[720px]` table scrolls inside its own wrapper (`AdminUsersDirectory.tsx:179`); the page itself does not scroll sideways.
- [ ] **≥ 1280px, tenant:** full 224px sidebar with wordmark, labels, and `AGENT` / `TOKO` / `AKUN & TAGIHAN` headers. Stat cards are back to their pre-redesign width.
- [ ] **Resize slowly through 640px and 1280px:** the rail swaps without a flash of the wrong width, and nothing shifts on first paint (the swap is CSS, not measured JavaScript).
- [ ] **Mobile viewport, `/`:** marketing hamburger opens the dropdown containing the nav plus the auth area.
