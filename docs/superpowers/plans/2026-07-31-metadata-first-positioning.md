# Metadata-First Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` a single-product sales page for Nerona Metadata and hide every Agent surface (public and in-app) behind one code constant, without touching the payment flow, the extension API, or agent's own logic.

**Architecture:** A new `AGENT_ENABLED` constant in `src/lib/features.ts` gates six things: the marketing nav, the tenant sidebar, the pricing product list, order creation, renewal generation, and the agent routes. Everything it gates becomes a pure function of a boolean so tests can drive both positions; the exported constants stay as the applied result so existing importers do not change. The home page picks between two components — `HomeMetadataOnly` (new, absorbs the old `/metadata` page) and `HomeMultiProduct` (the current home page, moved intact) — so flipping the flag really does restore the old site.

**Tech Stack:** Next.js 14 App Router (server components), Prisma, Tailwind, Vitest (node environment — **no component tests exist in this repo**).

Spec: `docs/superpowers/specs/2026-07-31-metadata-first-positioning-design.md`

## Global Constraints

- **`AGENT_ENABLED = false` is the shipped value.** Never leave it `true` at the end of a task.
- **Nothing under `src/lib/agent/**` changes.** The flag gates surfaces, never agent logic. The 23 test files in `tests/lib/agent/**` must stay green without edits.
- **`src/app/api/extension/**` is not touched by a single line.** It is the product being sold.
- **`/api/whatsapp/webhook` and `/api/agent/cron` are not touched.** Existing WhatsApp users keep being served. (`/api/agent/cron` runs agent message jobs — it is a different job from the renewal generator in Task 3.)
- **Admin pages are not touched.** The owner still needs to see agent state.
- **The payment flow does not change:** pick plan → order → transfer → upload proof → admin verifies.
- **No invented marketing claims.** No statistics, no testimonials, no live counters. Marketplace names come from `CLAIMABLE_MARKETPLACES`, point figures from `DEFAULT_PLAN_POINTS`, batch size from the extension's `BATCH_MAX_ITEMS` (50).
- Copy is Indonesian, matching the existing pages.
- Run `npm test` (not `npx vitest`) — the script is `vitest run`.
- **Pre-existing failures:** run `npm test` once before starting and write down which tests already fail. Do not attribute those to your changes, and do not fix them here.

---

### Task 1: The flag, and nav as a function of it

**Files:**
- Create: `src/lib/features.ts`
- Modify: `src/lib/nav.ts:14-53`
- Modify (rewrite): `tests/lib/tenant-nav.test.ts`

**Interfaces:**
- Produces: `AGENT_ENABLED: boolean` from `@/lib/features`; `marketingNav(agentEnabled: boolean): NavItem[]` and `tenantNav(agentEnabled: boolean): NavSection[]` from `@/lib/nav`, plus the unchanged exported constants `MARKETING_NAV: NavItem[]` and `TENANT_NAV: NavSection[]`.
- Consumes: the existing `NavItem`, `SidebarItem`, `NavSection` types in `src/lib/nav.ts`.

Every existing importer of `MARKETING_NAV` / `TENANT_NAV` (`MarketingHeader.tsx`, the app shell, `pageTitle`) keeps working untouched — that is the point of keeping the constants.

- [ ] **Step 1: Write the failing test** — replace the whole of `tests/lib/tenant-nav.test.ts` with this. It keeps every existing assertion that still holds, and converts the three that pinned the agent entry points into both-position assertions.

```ts
import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "@/components/ui/icons";
import {
  ADMIN_NAV,
  activeHref,
  flatten,
  marketingNav,
  pageTitle,
  tenantNav,
} from "@/lib/nav";

/**
 * Signing in swaps the marketing nav for the app sidebar. Anything a tenant
 * needs but cannot reach from there is effectively invisible — that has
 * already shipped three times: once for /pricing, once for the agent chat,
 * and once for /agent/dashboard.
 *
 * Agent is now hidden behind AGENT_ENABLED, so these tests pin BOTH
 * positions. The agent entry points must exist when the flag is on and be
 * absent when it is off; asserting only the shipped position would let a
 * future re-enable ship a sidebar with no way into the agent.
 */
describe("tenant navigation, agent enabled", () => {
  const hrefs = flatten(tenantNav(true)).map((item) => item.href);

  it("lets a tenant reach the agent chat", () => {
    expect(hrefs).toContain("/agent/chat");
  });

  it("lets a tenant reach the WhatsApp connection page", () => {
    expect(hrefs).toContain("/agent/dashboard");
  });

  it("keeps the tenant's own shop separate from Nerona billing", () => {
    const shop = tenantNav(true).find((s) => s.title === "Toko");
    const billing = tenantNav(true).find((s) => s.title === "Akun & Tagihan");
    expect(shop?.items.map((i) => i.href)).toEqual(["/produk", "/transaksi"]);
    expect(billing?.items.map((i) => i.href)).toEqual(["/paket", "/finance"]);
  });
});

describe("tenant navigation, agent hidden", () => {
  const sections = tenantNav(false);
  const hrefs = flatten(sections).map((item) => item.href);

  it("shows no agent entry points", () => {
    expect(hrefs).not.toContain("/agent/chat");
    expect(hrefs).not.toContain("/agent/dashboard");
    expect(sections.some((s) => s.title === "Agent")).toBe(false);
  });

  it("hides the shop too — it is the agent's surface", () => {
    expect(hrefs).not.toContain("/produk");
    expect(hrefs).not.toContain("/transaksi");
    expect(sections.some((s) => s.title === "Toko")).toBe(false);
  });

  it("still reaches the dashboard, metadata history and billing", () => {
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/riwayat-metadata");
    expect(hrefs).toContain("/paket");
    expect(hrefs).toContain("/finance");
  });

  it("never points a signed-in tenant at the public metadata page", () => {
    // "/metadata" is marketing; a sidebar entry there sends a tenant to the
    // sales page instead of their history.
    expect(hrefs).not.toContain("/metadata");
  });
});

describe("tenant navigation, both positions", () => {
  for (const enabled of [true, false]) {
    it(`has no duplicate destinations (agent ${enabled ? "on" : "off"})`, () => {
      const hrefs = flatten(tenantNav(enabled)).map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });
  }
});

describe("admin navigation", () => {
  const hrefs = flatten(ADMIN_NAV).map((item) => item.href);

  it("reaches every admin page", () => {
    expect(hrefs).toEqual([
      "/admin",
      "/admin/users",
      "/admin/orders",
      "/admin/metadata",
      "/admin/pengaturan",
    ]);
  });

  it("has no duplicate destinations", () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("marketing navigation", () => {
  it("offers the agent page only when agent is enabled", () => {
    expect(marketingNav(true).map((i) => i.href)).toContain("/agent");
    expect(marketingNav(false).map((i) => i.href)).not.toContain("/agent");
  });

  it("gives guests a pricing path in both positions", () => {
    expect(marketingNav(true).map((i) => i.href)).toContain("/pricing");
    expect(marketingNav(false).map((i) => i.href)).toContain("/pricing");
  });

  it("omits Home — the logo is the home link", () => {
    expect(marketingNav(true).map((i) => i.href)).not.toContain("/");
    expect(marketingNav(false).map((i) => i.href)).not.toContain("/");
  });

  it("drops the Metadata link when it is the home page", () => {
    // With agent hidden, "/" IS the metadata page, so a "Metadata" nav item
    // would point at the page the visitor is already on.
    expect(marketingNav(false).map((i) => i.href)).not.toContain("/metadata");
  });

  it("offers in-page anchors for the single-product landing", () => {
    expect(marketingNav(false).map((i) => i.href)).toEqual([
      "/#fitur",
      "/pricing",
      "/#faq",
    ]);
  });
});

describe("sidebar glyphs", () => {
  /**
   * Between sm and xl the sidebar is a 56px icon strip with no labels, so a
   * misspelled icon name renders nothing at all.
   */
  it("gives every sidebar item a glyph that exists", () => {
    const items = [
      ...flatten(tenantNav(true)),
      ...flatten(tenantNav(false)),
      ...flatten(ADMIN_NAV),
    ];
    for (const item of items) {
      expect(ICON_NAMES).toContain(item.icon);
    }
  });
});

describe("activeHref", () => {
  const tenant = flatten(tenantNav(true));

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
    expect(pageTitle("/finance", tenantNav(true))).toBe("Finance");
    expect(pageTitle("/agent/dashboard", tenantNav(true))).toBe("Koneksi WhatsApp");
  });

  it("names app pages that are deliberately absent from the sidebar", () => {
    expect(pageTitle("/profile", tenantNav(false))).toBe("Profile");
    expect(pageTitle("/order/abc123", tenantNav(false))).toBe("Order");
  });

  it("falls back to the brand name for anything unmapped", () => {
    expect(pageTitle("/totally-unknown", tenantNav(false))).toBe("Nerona");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/tenant-nav.test.ts`
Expected: FAIL — `marketingNav`/`tenantNav` are not exported from `@/lib/nav`.

- [ ] **Step 3: Create `src/lib/features.ts`**

```ts
/**
 * Product visibility switches.
 *
 * Nerona sells metadata only for now, so every Agent surface — the marketing
 * page, the pricing tab, the tenant sidebar groups, the agent routes, order
 * creation, and renewal invoices — is hidden behind this one constant.
 *
 * NOT an env var and NOT a Setting row on purpose: an env var can differ
 * between local and production with nothing in the repo to read, and a DB
 * row would cost a query on every nav render plus admin UI, for a switch
 * that gets flipped twice.
 *
 * Flip to `true` to restore every surface. What it does NOT restore: agent
 * renewal invoices that were skipped while it was off, or a plan that lapsed
 * in the meantime.
 *
 * Nothing under src/lib/agent/** is conditional on this — the WhatsApp
 * webhook and the agent job cron keep serving existing users either way.
 */
export const AGENT_ENABLED = false;
```

- [ ] **Step 4: Rewrite the nav definitions in `src/lib/nav.ts`**

Replace the `MARKETING_NAV` and `TENANT_NAV` declarations (lines 14-53, comments included) with the functions below. Add `import { AGENT_ENABLED } from "@/lib/features";` at the top of the file, after the existing `IconName` import. Leave `TITLE_OVERRIDES`, `flatten`, `matches`, `activeHref`, and `pageTitle` exactly as they are.

```ts
// Public marketing pages. Text-only — that is why NavItem stays separate from
// SidebarItem. "Home" is deliberately absent — the logo is the home link.
//
// With agent hidden, "/" IS the metadata sales page, so a "Metadata" item
// would point at the page the visitor is standing on. It is replaced by
// in-page anchors to that page's sections. "Harga" keeps pointing at
// /pricing rather than the landing's own pricing block, because /pricing is
// the only place the 3/6/12-month duration switcher lives.
export function marketingNav(agentEnabled: boolean): NavItem[] {
  if (!agentEnabled) {
    return [
      { href: "/#fitur", label: "Fitur" },
      { href: "/pricing", label: "Harga" },
      { href: "/#faq", label: "FAQ" },
    ];
  }
  return [
    { href: "/agent", label: "Agent" },
    { href: "/metadata", label: "Metadata" },
    { href: "/pricing", label: "Harga" },
  ];
}

// The tenant app sidebar. "Toko" is the tenant's OWN shop — products they
// sell and orders they receive. "Akun & Tagihan" is their billing
// relationship with Nerona.
//
// Agent and Toko are one world, so they are hidden together: the shop exists
// to be operated by the agent through add_product and record_sale, and
// without it those pages are manual bookkeeping. The pages and their queries
// stay in the codebase, just unreachable.
export function tenantNav(agentEnabled: boolean): NavSection[] {
  const sections: NavSection[] = [
    { items: [{ href: "/dashboard", label: "Dashboard", icon: "chart" }] },
  ];

  if (agentEnabled) {
    sections.push({
      title: "Agent",
      items: [
        { href: "/agent/chat", label: "Chat", icon: "chat" },
        { href: "/agent/dashboard", label: "Koneksi WhatsApp", icon: "link" },
      ],
    });
  }

  sections.push({
    title: "Metadata",
    // Bukan "/metadata" — path itu sudah dipakai halaman marketing publik.
    items: [{ href: "/riwayat-metadata", label: "Riwayat", icon: "clock" }],
  });

  if (agentEnabled) {
    sections.push({
      title: "Toko",
      items: [
        { href: "/produk", label: "Produk", icon: "box" },
        { href: "/transaksi", label: "Transaksi", icon: "receipt" },
      ],
    });
  }

  sections.push({
    title: "Akun & Tagihan",
    items: [
      { href: "/paket", label: "Paket & Harga", icon: "tag" },
      { href: "/finance", label: "Finance", icon: "wallet" },
    ],
  });

  return sections;
}

export const MARKETING_NAV: NavItem[] = marketingNav(AGENT_ENABLED);
export const TENANT_NAV: NavSection[] = tenantNav(AGENT_ENABLED);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/lib/tenant-nav.test.ts`
Expected: PASS, all describes.

- [ ] **Step 6: Check nothing else imported the removed shape**

Run: `npx tsc --noEmit`
Expected: no new errors. `MARKETING_NAV` and `TENANT_NAV` still exist with the same types, so importers are unaffected. If `tsc` is slow or unavailable, run `npm run build` instead.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features.ts src/lib/nav.ts tests/lib/tenant-nav.test.ts
git commit -m "feat: AGENT_ENABLED flag; nav becomes a function of it"
```

---

### Task 2: Pricing shows one product

**Files:**
- Modify: `src/lib/pricing-products.ts:15-45`
- Modify: `src/components/marketing/PricingSwitcher.tsx:41-65`
- Test: `tests/lib/pricing-products.test.ts` (create)

**Interfaces:**
- Consumes: `AGENT_ENABLED` from Task 1.
- Produces: `pricingProducts(agentEnabled?: boolean)` — same return shape as today, `{ products: PricingProduct[]; discounts: Record<number, number> }`, with the `agent` entry omitted when `agentEnabled` is false. Default parameter is `AGENT_ENABLED`, so the two existing callers (`/pricing` and `/paket`) need no edit.

- [ ] **Step 1: Write the failing test** — create `tests/lib/pricing-products.test.ts`. `metadataTiers`/`agentTiers` hit Prisma, so they are mocked; this test is about which products come back, not about tier contents.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pricing-tiers", () => ({
  metadataTiers: vi.fn(async () => [{ name: "Pro" }]),
  agentTiers: vi.fn(async () => [{ name: "Pro" }]),
}));

vi.mock("@/lib/plan-duration", () => ({
  PLAN_DURATIONS: [1, 3, 6, 12],
  getDurationDiscounts: vi.fn(async () => ({ 1: 0, 3: 5, 6: 10, 12: 20 })),
}));

import { pricingProducts } from "@/lib/pricing-products";

describe("pricingProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers metadata only when agent is hidden", async () => {
    const { products } = await pricingProducts(false);
    expect(products.map((p) => p.key)).toEqual(["metadata"]);
  });

  it("offers both products when agent is enabled", async () => {
    const { products } = await pricingProducts(true);
    expect(products.map((p) => p.key)).toEqual(["metadata", "agent"]);
  });

  it("does not compute agent tiers it will not show", async () => {
    const { agentTiers } = await import("@/lib/pricing-tiers");
    await pricingProducts(false);
    expect(agentTiers).not.toHaveBeenCalled();
  });

  it("still returns a tier set for every duration", async () => {
    const { products } = await pricingProducts(false);
    expect(Object.keys(products[0].tiersByDuration)).toEqual(["1", "3", "6", "12"]);
  });

  it("passes the discounts through untouched", async () => {
    const { discounts } = await pricingProducts(false);
    expect(discounts).toEqual({ 1: 0, 3: 5, 6: 10, 12: 20 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/pricing-products.test.ts`
Expected: FAIL — `pricingProducts` takes no argument yet, so the `false` call still returns both products.

- [ ] **Step 3: Rewrite `src/lib/pricing-products.ts`**

```ts
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { getDurationDiscounts, PLAN_DURATIONS } from "@/lib/plan-duration";
import { AGENT_ENABLED } from "@/lib/features";
import type { PricingProduct } from "@/components/marketing/PricingSwitcher";

/**
 * Semua tier untuk setiap durasi, dihitung sekali di server.
 *
 * Dikirim sekaligus, bukan diambil ulang saat user mengganti durasi: PricingSwitcher
 * adalah komponen client, dan memuat ulang tiap klik berarti halaman harga berkedip
 * untuk data yang jumlahnya cuma segini.
 *
 * Dipakai /pricing (publik) dan /paket (tenant) supaya keduanya tidak pernah
 * memperlihatkan harga yang berbeda.
 *
 * `agentEnabled` diambil dari AGENT_ENABLED secara default; parameternya ada
 * supaya tes bisa menguji kedua keadaan. Saat agent disembunyikan, tier-nya
 * tidak dihitung sama sekali — bukan dihitung lalu dibuang.
 */
export async function pricingProducts(agentEnabled: boolean = AGENT_ENABLED): Promise<{
  products: PricingProduct[];
  discounts: Record<number, number>;
}> {
  const [discounts, metadataSets, agentSets] = await Promise.all([
    getDurationDiscounts(),
    Promise.all(PLAN_DURATIONS.map((months) => metadataTiers(months))),
    agentEnabled
      ? Promise.all(PLAN_DURATIONS.map((months) => agentTiers(months)))
      : Promise.resolve(null),
  ]);

  const byDuration = (sets: Awaited<ReturnType<typeof metadataTiers>>[]) =>
    Object.fromEntries(PLAN_DURATIONS.map((months, i) => [months, sets[i]]));

  const products: PricingProduct[] = [
    {
      key: "metadata",
      label: "🖼️ Metadata",
      subheading: "Metadata otomatis untuk kontributor stock.",
      tiersByDuration: byDuration(metadataSets),
    },
  ];

  if (agentSets) {
    products.push({
      key: "agent",
      label: "💬 Agent",
      subheading: "Asisten AI WhatsApp untuk pemilik bisnis.",
      tiersByDuration: byDuration(agentSets),
    });
  }

  return { discounts, products };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/pricing-products.test.ts`
Expected: PASS.

- [ ] **Step 5: Hide the product tablist when there is only one product**

In `src/components/marketing/PricingSwitcher.tsx`, wrap the product tablist (the `<div className="flex justify-center">` block at lines 43-65) in a length check. A single tab is a control with nothing to switch to.

```tsx
      {/* Satu produk = tidak ada yang bisa dipilih; tablist-nya disembunyikan.
          Tab durasi tetap, karena itu memang pilihan. */}
      {products.length > 1 && (
        <div className="flex justify-center">
          <div
            role="tablist"
            aria-label="Pilih produk"
            className="flex gap-1 rounded-full bg-surface p-1.5 shadow-md shadow-navy-900/5 ring-1 ring-navy-900/10"
          >
            {products.map((product) => (
              <button
                key={product.key}
                role="tab"
                aria-selected={active === product.key}
                onClick={() => setActive(product.key)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  active === product.key
                    ? ACTIVE_STYLES[product.key] ?? "bg-navy-900/10 text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {product.label}
              </button>
            ))}
          </div>
        </div>
      )}
```

Then change the duration tablist's wrapper from `className="mt-4 flex justify-center"` to `className="flex justify-center"` when the product row is gone. Simplest correct form: `className={`${products.length > 1 ? "mt-4 " : ""}flex justify-center`}`. Leave everything below untouched.

- [ ] **Step 6: Verify the pages still build**

Run: `npm run build`
Expected: succeeds. Then `npm test` — the whole suite, still green apart from the pre-existing failures you recorded.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pricing-products.ts src/components/marketing/PricingSwitcher.tsx tests/lib/pricing-products.test.ts
git commit -m "feat: pricing shows metadata only while agent is hidden"
```

---

### Task 3: Refuse new agent orders and stop agent renewals

**Files:**
- Modify: `src/lib/orders.ts:142-158` (`submitOrder`), `src/lib/orders.ts:419-425` (`listPendingRenewals`)
- Modify: `src/lib/billing/renewals.ts:58-91`
- Modify: `src/app/(app)/order/page.tsx:21-29`
- Test: `tests/lib/agent-hidden-orders.test.ts` (create)

**Interfaces:**
- Consumes: `AGENT_ENABLED` from Task 1.
- Produces: no new exports. `submitOrder(userId, product, planName, contactNote?, durationMonths?)` keeps its signature and returns the existing `{ ok: false, reason: "invalid_product" }` for agent while hidden. `listPendingRenewals(userId)` keeps its signature and omits agent rows. `generateDueRenewals(now?, leadDays?)` keeps its signature and skips the agent pass.

**Do not touch the fulfilment path** (`orders.ts:322-390`). An agent order already placed must still be verifiable by an admin, or a customer's money is stuck in a pending order.

- [ ] **Step 1: Write the failing test** — create `tests/lib/agent-hidden-orders.test.ts`. Prisma is mocked; these tests are about the guards, not the database.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  orderRequest: {
    count: vi.fn(async () => 0),
    create: vi.fn(async (args: any) => ({ id: "req1", createdAt: new Date(0), ...args.data })),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
  },
  agentProfile: { findMany: vi.fn(async () => []) },
  license: { findMany: vi.fn(async () => []) },
  plan: { findFirst: vi.fn(async () => ({ id: "p1", name: "Pro" })) },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/features", () => ({ AGENT_ENABLED: false }));

// The renewal generator emails an invoice per row; none of that is under test.
vi.mock("@/lib/payment-settings", () => ({ getPaymentSettings: vi.fn(async () => ({})) }));
vi.mock("@/lib/billing/invoice", () => ({
  buildInvoicePdf: vi.fn(async () => Buffer.from("")),
  invoiceNumberFor: vi.fn(() => "INV-1"),
  priceLabelFor: vi.fn(async () => "Rp 99.000"),
}));
vi.mock("@/lib/mail", () => ({ sendRenewalInvoiceEmail: vi.fn(async () => undefined) }));

import { submitOrder, listPendingRenewals } from "@/lib/orders";
import { generateDueRenewals } from "@/lib/billing/renewals";

describe("submitOrder with agent hidden", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.orderRequest.findFirst.mockResolvedValue(null);
    prismaMock.plan.findFirst.mockResolvedValue({ id: "p1", name: "Pro" });
  });

  it("refuses a paid agent order", async () => {
    const result = await submitOrder("u1", "agent", "Pro");
    expect(result).toEqual({ ok: false, reason: "invalid_product" });
    expect(prismaMock.orderRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a FREE agent activation too", async () => {
    // submitOrder routes Free straight to activateFreeAgent, so the guard has
    // to sit above that branch or free activation slips through.
    const result = await submitOrder("u1", "agent", "Free");
    expect(result).toEqual({ ok: false, reason: "invalid_product" });
  });

  it("still accepts a metadata order", async () => {
    const result = await submitOrder("u1", "metadata", "Pro");
    expect(result.ok).toBe(true);
    expect(prismaMock.orderRequest.create).toHaveBeenCalled();
  });

  it("still rejects a genuinely unknown product", async () => {
    const result = await submitOrder("u1", "spaceship", "Pro");
    expect(result).toEqual({ ok: false, reason: "invalid_product" });
  });
});

describe("renewals with agent hidden", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.orderRequest.count.mockResolvedValue(0);
  });

  it("creates no agent renewal even when an agent plan is due", async () => {
    prismaMock.agentProfile.findMany.mockResolvedValue([
      {
        userId: "u1",
        plan: "pro",
        planDurationMonths: 1,
        user: { email: "a@b.c", name: "A", businessName: null },
      },
    ]);
    prismaMock.license.findMany.mockResolvedValue([]);

    const result = await generateDueRenewals(new Date("2026-08-01"));

    expect(result.created).toBe(0);
    expect(prismaMock.orderRequest.create).not.toHaveBeenCalled();
  });

  it("does not even query agent profiles it will skip", async () => {
    prismaMock.license.findMany.mockResolvedValue([]);
    await generateDueRenewals(new Date("2026-08-01"));
    expect(prismaMock.agentProfile.findMany).not.toHaveBeenCalled();
  });

  it("still creates metadata renewals", async () => {
    prismaMock.agentProfile.findMany.mockResolvedValue([]);
    prismaMock.license.findMany.mockResolvedValue([
      {
        userId: "u2",
        durationMonths: 1,
        plan: { name: "Pro" },
        user: { email: "c@d.e", name: "C", businessName: null },
      },
    ]);

    const result = await generateDueRenewals(new Date("2026-08-01"));

    expect(result.created).toBe(1);
    expect(prismaMock.orderRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ product: "metadata" }) })
    );
  });
});

describe("listPendingRenewals with agent hidden", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks the database for metadata renewals only", async () => {
    await listPendingRenewals("u1");
    expect(prismaMock.orderRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ product: "metadata" }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/agent-hidden-orders.test.ts`
Expected: FAIL — agent orders are still accepted and agent renewals are still created.

- [ ] **Step 3: Guard `submitOrder` in `src/lib/orders.ts`**

Add `import { AGENT_ENABLED } from "@/lib/features";` to the imports at the top of the file. Then insert the guard immediately after the existing `isProduct` check at line 149-151, **above** the `isKnownPlan` check and above the Free branch:

```ts
  if (!isProduct(product)) {
    return { ok: false, reason: "invalid_product" };
  }
  // Agent sedang disembunyikan, jadi order baru untuknya ditolak — termasuk
  // aktivasi Free, yang di bawah ini melompat langsung ke activateFreeAgent.
  //
  // Cek terpisah, bukan dijadikan bagian isProduct: isProduct adalah type
  // guard (`value is Product`), dan membuatnya menjawab "false" untuk sebuah
  // Product yang sah akan membuat tipenya berbohong.
  //
  // Jalur PEMENUHAN order tidak disentuh (lihat fulfilOrderRequest): order
  // agent yang sudah masuk harus tetap bisa diverifikasi admin, kalau tidak
  // uang pelanggan tersangkut di order pending.
  if (product === "agent" && !AGENT_ENABLED) {
    return { ok: false, reason: "invalid_product" };
  }
```

- [ ] **Step 4: Filter the renewal banner in the same file**

Replace `listPendingRenewals` (lines 419-425) with:

```ts
export async function listPendingRenewals(userId: string) {
  return prisma.orderRequest.findMany({
    where: {
      userId,
      status: "pending",
      isRenewal: true,
      // Tagihan perpanjangan Agent tidak ditampilkan selama produknya
      // disembunyikan — memintanya membayar sesuatu yang tidak bisa dia lihat
      // di mana pun lebih buruk daripada tidak menagih.
      ...(AGENT_ENABLED ? {} : { product: "metadata" }),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, product: true, planName: true, proofUploadedAt: true },
  });
}
```

- [ ] **Step 5: Skip the agent pass in `src/lib/billing/renewals.ts`**

Add `import { AGENT_ENABLED } from "@/lib/features";` after the existing imports. Then wrap the agent block (lines 65-90 — the `agentProfile.findMany` query and the `for` loop over it) in a flag check, so the query does not even run:

```ts
  // Selama Agent disembunyikan, perpanjangannya tidak dibuat sama sekali:
  // banner "Perpanjangan jatuh tempo" di /finance akan menyebut produk yang
  // sudah tidak ada di UI mana pun. Konsekuensinya disengaja — paket Agent
  // yang berjalan akan habis masa aktifnya lalu tidak diperpanjang.
  if (AGENT_ENABLED) {
    const profiles = await prisma.agentProfile.findMany({
      where: { status: "active", plan: { in: PAID_PLANS }, planExpiresAt: { lte: cutoff } },
      select: {
        userId: true,
        plan: true,
        // Perpanjangan mengikuti durasi yang dibeli: paket 6 bulan ditagih 6 bulan
        // lagi, bukan turun diam-diam ke bulanan.
        planDurationMonths: true,
        user: { select: { email: true, name: true, businessName: true } },
      },
    });
    for (const p of profiles) {
      if (await hasPending(p.userId, "agent")) continue;
      const months = coerceDuration(p.planDurationMonths);
      const req = await prisma.orderRequest.create({
        data: {
          userId: p.userId,
          product: "agent",
          planName: title(p.plan),
          durationMonths: months,
          isRenewal: true,
        },
      });
      created++;
      await emailInvoice(req, p.user, "agent", title(p.plan), months);
    }
  }
```

The metadata licence block below it is unchanged.

- [ ] **Step 6: Guard the order page**

In `src/app/(app)/order/page.tsx`, add `import { AGENT_ENABLED } from "@/lib/features";` and change the tier resolution (lines 21-29) so an agent URL falls into the existing "Pilih paket dulu" branch:

```tsx
  const agentOrderable = product === "agent" && AGENT_ENABLED;
  const tiers =
    product === "metadata"
      ? await metadataTiers(months)
      : agentOrderable
        ? await agentTiers(months)
        : null;
  const tier = tiers?.find((candidate) => candidate.name === planName);

  if (!tier || (product !== "metadata" && !agentOrderable)) {
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent-hidden-orders.test.ts`
Expected: PASS.

Then run the existing order/renewal suites, which must not regress:
Run: `npm test -- tests/lib/orders.test.ts tests/lib/agent/plan-expiry.test.ts`
Expected: no *new* failures versus the pre-existing list you recorded. If a test there asserts an agent renewal is created, read it: it may legitimately need `vi.mock("@/lib/features", () => ({ AGENT_ENABLED: true }))` to keep testing what it was written to test. Add that mock rather than deleting the assertion.

- [ ] **Step 8: Commit**

```bash
git add src/lib/orders.ts src/lib/billing/renewals.ts "src/app/(app)/order/page.tsx" tests/lib/agent-hidden-orders.test.ts
git commit -m "feat: refuse new agent orders and skip agent renewals while hidden"
```

---

### Task 4: Hide the agent routes and the APIs behind them

**Files:**
- Modify: `src/app/(app)/agent/chat/page.tsx`, `src/app/(app)/agent/dashboard/page.tsx`
- Modify: `src/app/api/agent/chat/route.ts`, `src/app/api/agent/link/route.ts`, `src/app/api/agent/status/route.ts`
- Test: `tests/lib/agent-hidden-routes.test.ts` (create)

**Interfaces:**
- Consumes: `AGENT_ENABLED` from Task 1.
- Produces: nothing new. The three API routes gain an early `403 { ok: false, error: "agent_disabled" }`.

**Not touched:** `src/app/api/agent/cron/route.ts` and `src/app/api/whatsapp/webhook/route.ts`. Those serve existing WhatsApp users and must keep working.

- [ ] **Step 1: Write the failing test** — create `tests/lib/agent-hidden-routes.test.ts`. Import the route handlers directly; the guard must fire before any dependency is reached, so nothing else needs mocking beyond what the modules pull in at import time.

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/features", () => ({ AGENT_ENABLED: false }));

// Imported by the routes at module load; the guard returns before any of it
// runs, but the mocks keep the import graph from touching a real database.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/session-guards", () => ({
  requireUser: vi.fn(async () => ({ user: { id: "u1" } })),
}));
vi.mock("@/lib/agent/profile", () => ({
  getOwnProfile: vi.fn(async () => ({ id: "p1", userId: "u1", status: "active" })),
}));
vi.mock("@/lib/agent/messages", () => ({ listChatHistory: vi.fn(async () => []) }));
vi.mock("@/lib/points", () => ({ getBalance: vi.fn(async () => 100) }));

describe("agent API routes while agent is hidden", () => {
  it("POST /api/agent/chat answers 403 agent_disabled", async () => {
    const { POST } = await import("@/app/api/agent/chat/route");
    const res = await POST(new Request("http://t/api/agent/chat", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "agent_disabled" });
  });

  it("POST /api/agent/link answers 403 agent_disabled", async () => {
    const { POST } = await import("@/app/api/agent/link/route");
    const res = await POST(new Request("http://t/api/agent/link", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
  });

  it("GET /api/agent/status answers 403 agent_disabled", async () => {
    const { GET } = await import("@/app/api/agent/status/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("does not gate the WhatsApp webhook or the agent job cron", async () => {
    // These two keep serving existing users. A guard added to either would
    // silently stop answering paying customers, so their absence is asserted.
    const webhook = await import("@/app/api/whatsapp/webhook/route");
    const cron = await import("@/app/api/agent/cron/route");
    expect(typeof webhook.POST).toBe("function");
    expect(typeof cron.GET).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/agent-hidden-routes.test.ts`
Expected: FAIL — the routes answer with their normal status codes, not 403.

- [ ] **Step 3: Guard the three API routes**

In each of `src/app/api/agent/chat/route.ts`, `link/route.ts`, and `status/route.ts`: add the import, then make the guard the **first** statement in the handler body — above token reads, session checks and rate limits, so nothing runs for a hidden product.

```ts
import { AGENT_ENABLED } from "@/lib/features";

// …inside POST (or GET for status), as the first statement:
  // Halaman yang memanggil endpoint ini sedang disembunyikan; endpoint-nya
  // tidak boleh tetap menjawab. Webhook WhatsApp dan cron job TIDAK dijaga —
  // pelanggan Agent yang sudah jalan tetap dilayani.
  if (!AGENT_ENABLED) {
    return NextResponse.json({ ok: false, error: "agent_disabled" }, { status: 403 });
  }
```

If a file does not already import `NextResponse`, add `import { NextResponse } from "next/server";`.

- [ ] **Step 4: Redirect the two agent pages**

In `src/app/(app)/agent/chat/page.tsx` and `src/app/(app)/agent/dashboard/page.tsx`, add the imports and make the redirect the first statement of the component — before `requireUser()`, so a hidden page does not query anything:

```tsx
import { redirect } from "next/navigation";
import { AGENT_ENABLED } from "@/lib/features";

// …first line of the component body:
  // redirect, bukan 404: bookmark lama mendarat di tempat yang berguna.
  if (!AGENT_ENABLED) redirect("/dashboard");
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/lib/agent-hidden-routes.test.ts`
Expected: PASS.

Run: `npm test -- tests/lib/agent-chat-route.test.ts`
Expected: this suite tests the chat route's real behaviour, so it needs `vi.mock("@/lib/features", () => ({ AGENT_ENABLED: true }))` added at the top of the file. Add it — the suite is testing agent logic, which the flag is not supposed to change.

- [ ] **Step 6: Full suite and build**

Run: `npm test` then `npm run build`
Expected: green apart from the pre-existing failures; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/agent" src/app/api/agent tests/lib/agent-hidden-routes.test.ts tests/lib/agent-chat-route.test.ts
git commit -m "feat: hide agent routes; their APIs answer 403 agent_disabled"
```

---

### Task 5: Split the home page in two

**Files:**
- Create: `src/components/marketing/home/HomeMultiProduct.tsx`
- Modify: `src/app/(marketing)/page.tsx` (becomes a thin picker)
- Modify: `src/app/(marketing)/agent/page.tsx` (add redirect)
- Modify: `src/components/layout/Footer.tsx:8-13, 32-34`

**Interfaces:**
- Consumes: `AGENT_ENABLED` from Task 1.
- Produces: `HomeMultiProduct` — a default-export-free named component, no props, `async` (it renders nothing that needs data today, but keep it `async` so it matches the page contract if it ever does). Task 6 adds `HomeMetadataOnly` next to it; this task leaves the picker referencing only `HomeMultiProduct` plus the existing metadata page content, so the site is never broken between tasks.

This task is deliberately a pure move: **no copy changes, no new sections.** Task 6 writes the new page. Keeping them apart means a reviewer can see that nothing was lost in the move.

- [ ] **Step 1: Move the current home page into a component**

Create `src/components/marketing/home/HomeMultiProduct.tsx` containing the *entire* current body of `src/app/(marketing)/page.tsx` — every import, `MARKETPLACE_NAMES`, the `FREE_METADATA_POINTS` / `FREE_AGENT_POINTS` constants with their comment, `HERO_FACTS`, `HOME_FAQ`, and the JSX — with two changes only:

- `export default function HomePage()` becomes `export function HomeMultiProduct()`
- the import paths change from `@/components/marketing/…` to `../…` (or keep the `@/` absolute paths — they work from anywhere; prefer keeping them unchanged to make the diff a pure move)

Add this header comment:

```tsx
/**
 * Beranda dua produk — dipakai saat AGENT_ENABLED true.
 *
 * Disimpan, bukan dihapus: kalau ini dihapus, menyalakan kembali
 * AGENT_ENABLED akan memulihkan nav dan route tapi meninggalkan beranda
 * satu-produk, dan saklarnya jadi berbohong. Isinya sengaja dibiarkan
 * apa adanya sejak dipindah dari app/(marketing)/page.tsx.
 */
```

- [ ] **Step 2: Turn the page into a picker**

Replace the whole of `src/app/(marketing)/page.tsx` with:

```tsx
import { AGENT_ENABLED } from "@/lib/features";
import { HomeMultiProduct } from "@/components/marketing/home/HomeMultiProduct";

/**
 * Beranda punya dua bentuk, dipilih oleh AGENT_ENABLED: halaman jualan
 * metadata tunggal, atau beranda dua produk. Task 6 mengisi cabang
 * metadata-only; sampai itu masuk, keduanya menampilkan beranda lama.
 */
export default function HomePage() {
  if (!AGENT_ENABLED) {
    return <HomeMultiProduct />;
  }
  return <HomeMultiProduct />;
}
```

(Yes, both branches are the same for one task. That is the honest intermediate state: the move is reviewable on its own, and Task 6 replaces the first branch. Do not collapse the `if` — it would just have to be rewritten.)

- [ ] **Step 3: Redirect `/agent`**

At the top of `src/app/(marketing)/agent/page.tsx`, add the imports and make the redirect the component's first statement:

```tsx
import { redirect } from "next/navigation";
import { AGENT_ENABLED } from "@/lib/features";

// …first line of the component body:
  if (!AGENT_ENABLED) redirect("/");
```

- [ ] **Step 4: Fix the footer**

In `src/components/layout/Footer.tsx`, make the link list depend on the flag and correct the tagline:

```tsx
import { AGENT_ENABLED } from "@/lib/features";

// replace the FOOTER_LINKS constant:
// Dengan agent disembunyikan, "/" ADALAH halaman metadata, jadi kedua
// tautan produk itu menunjuk ke tempat yang sama dengan Home.
const FOOTER_LINKS = AGENT_ENABLED
  ? [
      { href: "/", label: "Home" },
      { href: "/agent", label: "Agent" },
      { href: "/metadata", label: "Metadata" },
      { href: "/pricing", label: "Harga" },
    ]
  : [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Harga" },
    ];
```

And the tagline at line 32-34 — it currently claims both audiences:

```tsx
        <p className="mt-2 max-w-md text-xs text-muted">
          {AGENT_ENABLED
            ? "Alat AI untuk kontributor stock dan pemilik bisnis."
            : "Alat AI untuk kontributor stock."}
        </p>
```

- [ ] **Step 5: Verify the move lost nothing**

Run: `npm run build`
Expected: succeeds.

Run: `git diff --stat HEAD` — `page.tsx` shrinks to ~15 lines and `HomeMultiProduct.tsx` appears at roughly the old page's length. If the new component is much shorter than the old page, something was dropped.

Start the dev server (`npm run dev`) and open `/`: it must look **exactly** as it did before this task. Open `/agent`: it must land on `/`.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/home/HomeMultiProduct.tsx "src/app/(marketing)/page.tsx" "src/app/(marketing)/agent/page.tsx" src/components/layout/Footer.tsx
git commit -m "refactor: move the two-product home page into HomeMultiProduct; redirect /agent"
```

---

### Task 6: The metadata sales page

**Files:**
- Create: `src/components/marketing/home/HomeMetadataOnly.tsx`
- Create: `src/components/marketing/ContributorPainSection.tsx`
- Create: `src/components/marketing/mockups/RejectAnalysisMockup.tsx`
- Modify: `src/app/(marketing)/page.tsx` (point the metadata-only branch at the new component)
- Modify: `src/app/(marketing)/metadata/page.tsx` (redirect)
- Modify: `src/components/marketing/Hero.tsx` (CTAs)
- Modify: `src/components/marketing/FeatureSection.tsx` (accept an `id`)
- Modify: `src/components/marketing/FaqSection.tsx` (accept an `id`)

**Interfaces:**
- Consumes: `AGENT_ENABLED`; the existing `Hero`, `FeatureSection`, `MarketplaceRow`, `StepsSection`, `FaqSection`, `CtaBanner`, `PricingTiers`, `MarketplaceTabsMockup`, `KeywordChipsMockup`, `BatchProgressMockup`; `metadataTiers()` from `@/lib/pricing-tiers`; `CLAIMABLE_MARKETPLACES` from `@/lib/marketplaces`; `DEFAULT_PLAN_POINTS` from `@/lib/plan-points`.
- Produces: `HomeMetadataOnly` — `async` component, no props (it awaits `metadataTiers()`); `ContributorPainSection` — no props; `RejectAnalysisMockup` — no props.

Approved mockup for the layout and copy: <https://claude.ai/code/artifact/bc6d1ec3-bf4e-48a7-9f97-275365c2b9ed>

- [ ] **Step 1: Let `FeatureSection` carry an anchor**

The nav links to `/#fitur`, so the first feature section needs an `id`. In `src/components/marketing/FeatureSection.tsx`, add `id?: string` to `FeatureSectionProps` and pass it through:

```tsx
interface FeatureSectionProps {
  title: string;
  body: string;
  mockup: React.ReactNode;
  theme: "light" | "dark" | "navy";
  imageSide: "left" | "right";
  bullets?: string[];
  /** Anchor target, so the top nav can link to a section. */
  id?: string;
}
```

and in the component signature add `id`, then `<section id={id} className={...}>`. Nothing else changes.

- [ ] **Step 2: Write the pain section**

Create `src/components/marketing/ContributorPainSection.tsx`:

```tsx
/**
 * Tiga keluhan yang bikin unggahan tertahan — bentuknya meniru halaman
 * jualan sejenis, tapi TANPA statistik: tidak ada angka yang tidak bisa
 * kita buktikan (lihat spec marketing-honesty).
 */
const PAINS = [
  {
    quote: "Karyanya sudah siap. Metadatanya belum.",
    body: "Satu gambar butuh judul, deskripsi, dan puluhan kata kunci. Dikerjakan tangan, itu menit yang hilang sebelum karya pertama naik.",
  },
  {
    quote: "500 gambar. Proses yang sama. Setiap kali.",
    body: "Batch besar bukan pekerjaan yang lebih sulit — hanya pekerjaan yang sama, diulang sampai Anda berhenti.",
  },
  {
    quote: "Tiap marketplace punya aturannya sendiri.",
    body: "Batas kata kunci, format judul, gaya deskripsi — semuanya berbeda, dan salah format berarti ditolak.",
  },
];

export function ContributorPainSection() {
  return (
    <section className="bg-surface2 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-ink">
          Kenapa unggahan Anda tertahan
        </h2>
        <p className="mx-auto mt-2.5 max-w-2xl text-center text-[15px] text-muted">
          Bukan karyanya yang lambat — pekerjaan sesudahnyalah yang lambat.
        </p>
        <div className="mt-11 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PAINS.map((pain) => (
            <div
              key={pain.quote}
              className="flex flex-col gap-2.5 rounded-2xl bg-surface p-6 ring-1 ring-navy-900/10"
            >
              <span
                className="h-[3px] w-7 rounded-full bg-gradient-to-r from-gold-500 to-gold-400"
                aria-hidden="true"
              />
              <p className="text-[17px] font-semibold leading-snug tracking-tight text-ink">
                &ldquo;{pain.quote}&rdquo;
              </p>
              <p className="text-[13.5px] leading-relaxed text-muted">{pain.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write the reject-analysis mockup**

Create `src/components/marketing/mockups/RejectAnalysisMockup.tsx`. This one sits on the navy band, so it is a dark card — the only mockup in the set that is.

```tsx
const FINDINGS = [
  {
    lead: "Noise di area langit.",
    body: "Terlihat jelas pada 100% di kuadran kanan atas, paling mungkin dari ISO tinggi.",
  },
  {
    lead: "Perbaiki lalu unggah ulang.",
    body: "Kurangi noise pada langit saja — jangan seluruh bingkai, detail gedung akan ikut hilang.",
  },
  {
    lead: "Judul & kata kunci tidak jadi masalah.",
    body: "Keduanya sesuai; tidak perlu diubah.",
  },
];

/** Kartu gelap: satu-satunya mockup yang duduk di band navy. */
export function RejectAnalysisMockup() {
  return (
    <div className="rounded-3xl bg-white/5 p-7 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-100/75">
          Analisis penolakan
        </p>
        <span className="rounded-full bg-rose-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200">
          Adobe Stock · Ditolak
        </span>
      </div>
      <p className="mt-4 rounded-r-xl border-l-[3px] border-rose-200/60 bg-white/[0.04] px-3.5 py-3 text-[13.5px] italic text-rose-100">
        &ldquo;Quality issues — noise, artifacts or film grain&rdquo;
      </p>
      <ul className="mt-4 space-y-3 text-[13.5px] text-navy-100">
        {FINDINGS.map((finding) => (
          <li key={finding.lead} className="flex items-start gap-2.5">
            <span
              className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-brand-sky"
              aria-hidden="true"
            />
            <span>
              <b className="font-semibold text-white">{finding.lead}</b> {finding.body}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Change the hero's CTAs**

In `src/components/marketing/Hero.tsx`, the primary CTA currently scrolls to `#pricing`. A sales page asks for the signup first. Replace the CTA row (lines 23-38) with:

```tsx
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/register"
            className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-lg shadow-gold-500/30 transition hover:brightness-110"
          >
            Mulai gratis
          </Link>
          <Link
            href="#pricing"
            className="rounded-full bg-surface px-6 py-2.5 text-sm font-medium text-ink ring-1 ring-navy-900/15 transition hover:bg-surface2"
          >
            Lihat harga
          </Link>
        </div>
```

Then add the trust line below the CTAs, above the mockup — the facts row the old home page had, now stated for metadata only:

```tsx
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] text-muted">
          {[
            `${CLAIMABLE_MARKETPLACES.length} marketplace didukung`,
            "Tanpa kartu kredit",
            `${DEFAULT_PLAN_POINTS.metadata.free} poin gratis untuk mencoba`,
          ].map((fact) => (
            <li key={fact} className="inline-flex items-center gap-1.5">
              <span className="font-bold text-emerald-600" aria-hidden="true">
                ✓
              </span>
              {fact}
            </li>
          ))}
        </ul>
```

Add the two imports this needs at the top of `Hero.tsx`:

```tsx
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";
```

Leave the commented-out `/learn` link where it is — it is a deliberate marker, not dead weight.

- [ ] **Step 5: Assemble the page**

Create `src/components/marketing/home/HomeMetadataOnly.tsx`:

```tsx
import { Hero } from "@/components/marketing/Hero";
import { ContributorPainSection } from "@/components/marketing/ContributorPainSection";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { MarketplaceRow } from "@/components/marketing/MarketplaceRow";
import { StepsSection } from "@/components/marketing/StepsSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { PricingTiers } from "@/components/marketing/PricingTiers";
import { MarketplaceTabsMockup } from "@/components/marketing/mockups/MarketplaceTabsMockup";
import { KeywordChipsMockup } from "@/components/marketing/mockups/KeywordChipsMockup";
import { BatchProgressMockup } from "@/components/marketing/mockups/BatchProgressMockup";
import { RejectAnalysisMockup } from "@/components/marketing/mockups/RejectAnalysisMockup";
import { metadataTiers } from "@/lib/pricing-tiers";
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";

const MARKETPLACE_NAMES = CLAIMABLE_MARKETPLACES.map((m) => m.label).join(", ");

/**
 * Angka poin Free diambil dari default kode. Owner bisa menimpanya di
 * Pengaturan; kalau itu terjadi, kalimat di bawah harus ikut diperbarui.
 * Alternatifnya satu query DB di halaman yang selain ini tidak butuh apa pun.
 */
const FREE_METADATA_POINTS = DEFAULT_PLAN_POINTS.metadata.free;

/** Batas satu batch di ekstensi (BATCH_MAX_ITEMS di nerona_medata). */
const BATCH_MAX_ITEMS = 50;

const METADATA_FAQ = [
  {
    question: "Apakah saya perlu kartu kredit untuk mulai?",
    answer:
      "Tidak. Paket Free aktif seketika setelah daftar, tanpa data pembayaran apa pun. Free adalah poin percobaan sekali per akun, bukan kuota bulanan.",
  },
  {
    question: "Marketplace apa saja yang didukung?",
    answer: `${MARKETPLACE_NAMES}.`,
  },
  {
    question: "Apa itu poin, dan bagaimana kalau habis?",
    answer:
      "Poin terpakai setiap kali AI bekerja — besarnya tergantung gambar dan panjang teks yang diproses. Alat berhenti sementara kalau poin habis; mengaktifkan atau memperpanjang paket menambahkan poin baru. Poin yang belum terpakai tidak hangus.",
  },
  {
    question: "Bagaimana cara memasang ekstensinya?",
    answer:
      "Unduh folder ekstensi dari halaman Profile Anda, lalu muat lewat Chrome dengan Load unpacked. Belum melalui Chrome Web Store, jadi pembaruan kami beritahukan dari dalam aplikasi.",
  },
  {
    question: "Bagaimana cara pembayarannya?",
    answer:
      "Lewat transfer bank. Pilih paket, kirim order, transfer sesuai nominal, lalu unggah bukti transfer — tim kami memverifikasi dan mengaktifkan akun Anda, biasanya di hari yang sama.",
  },
];

/**
 * Beranda satu produk: halaman jualan Nerona Metadata.
 *
 * Isinya menyerap halaman /metadata yang lama (yang sekarang mengalihkan ke
 * sini) plus dua bagian baru: keluhan kontributor dan reject analyzer. Band
 * navy pada reject analyzer menggantikan satu-satunya bagian gelap di
 * beranda, yang dulu milik Agent.
 */
export async function HomeMetadataOnly() {
  const tiers = await metadataTiers();

  return (
    <main>
      <Hero />

      <ContributorPainSection />

      <FeatureSection
        id="fitur"
        title={`Satu klik. ${CLAIMABLE_MARKETPLACES.length} marketplace.`}
        body={`Bekerja langsung di formulir unggah ${MARKETPLACE_NAMES} — tanpa salin-tempel.`}
        mockup={<MarketplaceTabsMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Kata kunci yang konsisten."
        body="Puluhan kata kunci hasil AI — sebanyak yang marketplace tujuan izinkan — plus ruang untuk kata kunci Anda sendiri di setiap unggahan."
        mockup={<KeywordChipsMockup />}
        theme="light"
        imageSide="right"
      />
      <FeatureSection
        title="Dibuat untuk unggahan massal."
        body="Pilih banyak gambar sekaligus, pantau progres per gambar, dan terapkan ke semua tab marketplace yang terbuka."
        bullets={[
          `Sampai ${BATCH_MAX_ITEMS} gambar dalam satu batch`,
          "Progres per gambar, bukan satu bar buta",
          "Berhenti kapan saja tanpa kehilangan yang sudah jadi",
        ]}
        mockup={<BatchProgressMockup />}
        theme="dark"
        imageSide="left"
      />
      <FeatureSection
        title="Ditolak? Cari tahu kenapa."
        body="Reject analyzer membaca gambar Anda bersama alasan penolakan marketplace, lalu menyebut apa yang sebenarnya perlu diperbaiki — supaya unggahan berikutnya tidak mengulang kesalahan yang sama."
        bullets={[
          "Menunjuk masalahnya, bukan menebak",
          "Memberi tahu juga apa yang sudah benar",
          "Tersedia di paket Business",
        ]}
        mockup={<RejectAnalysisMockup />}
        theme="navy"
        imageSide="right"
      />

      <MarketplaceRow />

      <StepsSection
        title="Mulai dalam tiga langkah"
        subtitle="Tanpa kartu kredit."
        steps={[
          {
            title: "Daftar gratis",
            body: "Buat akun dengan email — paket Free langsung aktif, tanpa data pembayaran.",
          },
          {
            title: "Pasang ekstensi Chrome",
            body: "Unduh folder ekstensi Nerona Metadata, lalu muat lewat Chrome — kami memandu langkahnya.",
          },
          {
            title: "Upgrade saat butuh",
            body: "Poin habis? Pilih paket, transfer, dan akun aktif setelah verifikasi tim kami.",
          },
        ]}
      />

      <PricingTiers
        id="pricing"
        heading="Harga Nerona Metadata"
        subheading="Paket Free memberi poin percobaan sekali per akun. Upgrade untuk poin bulanan."
        tiers={tiers}
      />

      <FaqSection id="faq" items={METADATA_FAQ} className="bg-surface" />

      <CtaBanner
        title="Coba gratis hari ini"
        body={`Paket Free memberi ${FREE_METADATA_POINTS} poin Metadata, sekali per akun. Poin terpakai setiap kali AI bekerja — cukup untuk menilai hasilnya sebelum Anda memutuskan.`}
        ctaLabel="Buat akun gratis"
        ctaHref="/register"
      />
    </main>
  );
}
```

The `id="faq"` above needs `FaqSection` to accept one — it does not today. Give it the same treatment `FeatureSection` got in Step 1, in `src/components/marketing/FaqSection.tsx`:

```tsx
export function FaqSection({
  items,
  title = "Pertanyaan umum",
  className = "bg-surface",
  id,
}: {
  items: FaqItem[];
  title?: string;
  className?: string;
  /** Anchor target, so the top nav can link to this section. */
  id?: string;
}) {
  return (
    <section id={id} className={`px-6 py-20 ${className}`}>
```

The rest of the component is unchanged. Do not reach for a bare `<div id="faq" />` instead — an anchor div placed after the section scrolls past the heading.

- [ ] **Step 6: Wire the picker and redirect the old page**

`src/app/(marketing)/page.tsx`:

```tsx
import { AGENT_ENABLED } from "@/lib/features";
import { HomeMetadataOnly } from "@/components/marketing/home/HomeMetadataOnly";
import { HomeMultiProduct } from "@/components/marketing/home/HomeMultiProduct";

/**
 * Beranda punya dua bentuk, dipilih oleh AGENT_ENABLED: halaman jualan
 * metadata tunggal, atau beranda dua produk.
 */
export default function HomePage() {
  return AGENT_ENABLED ? <HomeMultiProduct /> : <HomeMetadataOnly />;
}
```

`src/app/(marketing)/metadata/page.tsx` — its content now lives on the home page:

```tsx
import { redirect } from "next/navigation";
import { AGENT_ENABLED } from "@/lib/features";
// …existing imports stay for the AGENT_ENABLED branch

export default async function MetadataPage() {
  // Isi halaman ini sekarang ada di beranda; tautan lama tetap mendarat benar.
  if (!AGENT_ENABLED) redirect("/");

  const tiers = await metadataTiers();
  return ( /* the existing JSX, unchanged */ );
}
```

- [ ] **Step 7: Verify by eye — there is no test for this**

There are no component tests in this repo, so this step is the verification.

Run: `npm run build` — must succeed. Then `npm run dev` and check:

1. `/` — hero says "Mulai gratis" first; the pain section reads correctly; four feature sections; the fourth is the dark navy band with the reject card; marketplace row lists 7; three steps; pricing; FAQ; closing CTA.
2. Clicking **Fitur** in the top nav scrolls to "Satu klik. 7 marketplace." Clicking **FAQ** scrolls to the FAQ. Clicking **Lihat harga** in the hero scrolls to the pricing block.
3. `/metadata` lands on `/`.
4. No number appears anywhere that is not `CLAIMABLE_MARKETPLACES.length` (7), `DEFAULT_PLAN_POINTS.metadata.free` (10), `BATCH_MAX_ITEMS` (50), or a price from the database.
5. Narrow the window to phone width: nothing scrolls sideways; the navy card stays readable.

- [ ] **Step 8: Commit**

```bash
git add src/components/marketing "src/app/(marketing)"
git commit -m "feat: single-product metadata landing at /; /metadata redirects home"
```

---

### Task 7: Rebuild the tenant dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (rewrite)
- Create: `src/lib/extension-connection.ts`
- Test: `tests/lib/extension-connection.test.ts` (create)

**Interfaces:**
- Consumes: `getBalance`, `listTransactions` (`@/lib/points`); `getMetadataLogStats`, `listMetadataLogsForUser` (`@/lib/metadata-log`); `prisma.license`, `prisma.extensionToken`; `requireUser` (`@/lib/session-guards`).
- Produces: `getExtensionConnectionState(userId: string): Promise<ExtensionConnectionState>` where

```ts
export type ExtensionConnectionState =
  | { status: "none" }        // no token issued yet
  | { status: "unused" }      // token exists, never called the API
  | { status: "connected"; lastUsedAt: Date };
```

`getDashboardSummary` and `getSalesSeries` stay in `src/lib/shop-dashboard.ts`, unused. Do not delete them.

- [ ] **Step 1: Write the failing test** — create `tests/lib/extension-connection.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  extensionToken: { findMany: vi.fn(async () => [] as any[]) },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getExtensionConnectionState } from "@/lib/extension-connection";

describe("getExtensionConnectionState", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports none when the user has never made a token", async () => {
    prismaMock.extensionToken.findMany.mockResolvedValue([]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({ status: "none" });
  });

  it("reports unused when a token exists but has never been called", async () => {
    prismaMock.extensionToken.findMany.mockResolvedValue([{ lastUsedAt: null }]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({ status: "unused" });
  });

  it("reports connected with the most recent use", async () => {
    const recent = new Date("2026-07-30T10:00:00Z");
    const older = new Date("2026-07-01T10:00:00Z");
    prismaMock.extensionToken.findMany.mockResolvedValue([
      { lastUsedAt: older },
      { lastUsedAt: recent },
    ]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({
      status: "connected",
      lastUsedAt: recent,
    });
  });

  it("counts a used token even when an unused one exists alongside it", async () => {
    const used = new Date("2026-07-30T10:00:00Z");
    prismaMock.extensionToken.findMany.mockResolvedValue([
      { lastUsedAt: null },
      { lastUsedAt: used },
    ]);
    await expect(getExtensionConnectionState("u1")).resolves.toEqual({
      status: "connected",
      lastUsedAt: used,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/extension-connection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/extension-connection.ts`**

```ts
import { prisma } from "@/lib/prisma";

export type ExtensionConnectionState =
  | { status: "none" }
  | { status: "unused" }
  | { status: "connected"; lastUsedAt: Date };

/**
 * Sudahkah ekstensi orang ini benar-benar terhubung?
 *
 * Membuat token saja tidak cukup — banyak yang membuatnya lalu berhenti
 * sebelum menempelkannya di popup. `lastUsedAt` baru terisi setelah
 * ekstensi memanggil API dengan token itu, jadi itulah bukti pemasangannya
 * selesai. Dipakai dashboard untuk memutuskan seberapa besar panduan
 * pemasangan ditampilkan.
 */
export async function getExtensionConnectionState(
  userId: string
): Promise<ExtensionConnectionState> {
  const tokens = await prisma.extensionToken.findMany({
    where: { userId },
    select: { lastUsedAt: true },
  });

  if (tokens.length === 0) return { status: "none" };

  const used = tokens
    .map((t) => t.lastUsedAt)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime());

  if (used.length === 0) return { status: "unused" };
  return { status: "connected", lastUsedAt: used[0] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/extension-connection.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `src/app/(app)/dashboard/page.tsx`**

Replace the file entirely. The shop stats, the sales chart, top products and low stock all go; `getDashboardSummary` and `getSalesSeries` are no longer imported here.

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { getBalance, listTransactions } from "@/lib/points";
import { getMetadataLogStats, listMetadataLogsForUser } from "@/lib/metadata-log";
import { getExtensionConnectionState } from "@/lib/extension-connection";

export const metadata = { title: "Dashboard — Nerona" };

const POINT_REASON_LABEL: Record<string, string> = {
  manual_adjust: "Penyesuaian admin",
  spend: "Pemakaian AI",
  topup: "Top-up",
};

const cardClass =
  "rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cardClass}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();
  const [balance, pointsHistory, stats, recentLogs, license, connection] = await Promise.all([
    getBalance(session.user.id),
    listTransactions(session.user.id, 5),
    getMetadataLogStats(session.user.id),
    listMetadataLogsForUser(session.user.id, 5),
    prisma.license.findFirst({
      where: { userId: session.user.id, status: { in: ["active", "comp"] } },
      orderBy: { createdAt: "desc" },
      select: { validUntil: true, plan: { select: { name: true } } },
    }),
    getExtensionConnectionState(session.user.id),
  ]);

  const planValue = license?.plan?.name ?? "Free";
  const planHint = license?.validUntil
    ? `Berlaku sampai ${fmtDate(license.validUntil)}`
    : license
      ? "Aktif"
      : "Belum ada paket berbayar";

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>

        {/* Pemasangan ekstensi adalah pekerjaan pertama seorang pelanggan baru,
            jadi panduannya menonjol sampai ekstensinya benar-benar dipakai.
            Panelnya sendiri tetap satu, di /profile — disalin ke sini berarti
            dua tempat yang harus dijaga bersamaan. */}
        {connection.status !== "connected" && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gold-400/15 p-5 ring-1 ring-gold-400/40">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {connection.status === "none"
                  ? "Ekstensi belum terhubung"
                  : "Tokennya sudah dibuat — tinggal ditempel"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {connection.status === "none"
                  ? "Unduh ekstensi Nerona Metadata, pasang di Chrome, lalu tempel token akun Anda."
                  : "Buka popup ekstensi di Chrome dan tempel token yang sudah Anda buat."}
              </p>
            </div>
            <Link
              href="/profile"
              className="whitespace-nowrap rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
            >
              Hubungkan ekstensi
            </Link>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Saldo poin" value={balance.toLocaleString("id-ID")} />
          <Stat label="Paket" value={planValue} hint={planHint} />
          <Stat label="Metadata 7 hari terakhir" value={stats.last7Days.toLocaleString("id-ID")} />
          <Stat label="Total metadata" value={stats.total.toLocaleString("id-ID")} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Metadata terbaru</p>
              <Link href="/riwayat-metadata" className="text-xs text-brand-blue hover:underline">
                Lihat semua
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-navy-900/10">
              {recentLogs.length === 0 && (
                <li className="py-2 text-sm text-muted">
                  Belum ada metadata. Hasil generate pertama Anda akan muncul di sini.
                </li>
              )}
              {recentLogs.map((log) => (
                <li key={log.id} className="py-2">
                  <p className="truncate text-sm text-ink">{log.title || "Tanpa judul"}</p>
                  <p className="text-xs text-muted">
                    {log.marketplace} · {log.keywordCount} kata kunci · {fmtDate(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div className={cardClass}>
              <p className="text-sm font-semibold text-ink">Marketplace teratas</p>
              <ul className="mt-3 space-y-2 text-sm">
                {stats.perMarketplace.length === 0 && (
                  <li className="text-muted">Belum ada data.</li>
                )}
                {stats.perMarketplace.slice(0, 5).map((row) => (
                  <li key={row.marketplace} className="flex justify-between gap-3">
                    <span className="text-ink">{row.marketplace}</span>
                    <span className="tabular-nums text-muted">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">Poin</p>
                <Link href="/finance" className="text-xs text-brand-blue hover:underline">
                  Lihat semua
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted">
                Poin terpakai setiap kali AI membuat metadata.
              </p>
              <ul className="mt-3 divide-y divide-navy-900/10">
                {pointsHistory.length === 0 && (
                  <li className="py-2 text-sm text-muted">Belum ada aktivitas poin.</li>
                )}
                {pointsHistory.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {POINT_REASON_LABEL[t.reason] ?? t.reason}
                        {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                      </p>
                      <p className="text-xs text-muted">{fmtDate(t.createdAt)}</p>
                    </div>
                    <span
                      className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                        t.delta >= 0 ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {t.delta >= 0 ? "+" : ""}
                      {t.delta.toLocaleString("id-ID")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm test` and `npm run build` — green (bar the pre-existing failures) and building.

Then `npm run dev`, sign in as a tenant and open `/dashboard`: no revenue, orders, stock or sales chart anywhere; the four stat tiles read points / plan / 7-day / total; the gold callout appears if you have never used a token; the points card says metadata, not WhatsApp.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx" src/lib/extension-connection.ts tests/lib/extension-connection.test.ts
git commit -m "feat: metadata dashboard with extension onboarding state"
```

---

### Task 8: Finance page — drop the agent row, keep the history honest

**Files:**
- Modify: `src/app/(app)/finance/page.tsx`

**Interfaces:**
- Consumes: `AGENT_ENABLED`; everything the page already imports.
- Produces: nothing new.

There is no test here: the page is a server component and this repo has no component tests. It is verified by eye in Step 4.

- [ ] **Step 1: Stop querying and rendering the agent plan**

Add `import { AGENT_ENABLED } from "@/lib/features";`.

In the `Promise.all` (lines 33-57), replace the `agentProfile` query with a conditional so the row is not even fetched while agent is hidden:

```tsx
    AGENT_ENABLED
      ? prisma.agentProfile.findUnique({
          where: { userId: session.user.id },
          select: { plan: true, status: true, planExpiresAt: true },
        })
      : Promise.resolve(null),
```

Then wrap the "Agent WhatsApp" `<li>` in the Paket section (lines 125-137) in `{agentProfile && ( … )}`. Since `agentProfile` is now `null` whenever the flag is off, no extra flag check is needed there — but leave a comment saying why:

```tsx
          {/* Baris Agent hanya ada kalau produknya ditampilkan: agentProfile
              di-null-kan di atas saat AGENT_ENABLED false. */}
          {agentProfile && (
            <li className="flex items-center justify-between gap-3">
              {/* …existing content unchanged… */}
            </li>
          )}
```

- [ ] **Step 2: Add the empty state the Paket list can now hit**

With the agent row gone, a user with no metadata licence renders an empty `<ul>`. Add, as the last child of that list:

```tsx
          {!agentProfile && !license && (
            <li className="flex flex-wrap items-center justify-between gap-2 py-1">
              <span className="text-muted">Belum ada paket aktif.</span>
              <Link href="/paket" className="text-xs text-brand-blue hover:underline">
                Lihat paket ›
              </Link>
            </li>
          )}
```

- [ ] **Step 3: Leave `hasActivePlan` alone; fix only the points copy**

`TopupCard`'s `hasActivePlan` (lines 155-158) needs **no edit**. Step 1 made `agentProfile` `null` whenever the flag is off, so the agent half of that expression already collapses to `false` and the whole thing evaluates to `Boolean(license)` — and it stays correct when the flag flips back. Rewriting it by hand would only be a second place to get wrong. Verify it reads as it does today and move on.

Change the copy at line 172-174, and nothing else in this step:

```tsx
          <p className="mt-1 text-xs text-muted">
            Poin terpakai setiap kali AI bekerja.
          </p>
```

Do **not** touch the "Pembelian" list or its `product === "agent" ? "Agent" : "Metadata"` label. That row is money the customer actually spent; relabelling or hiding it would misstate a transaction.

- [ ] **Step 4: Verify**

Run: `npm run build` — succeeds. `npm test` — no new failures.

`npm run dev`, then `/finance`:
- No "Agent WhatsApp" row in Paket.
- A tenant with no licence sees "Belum ada paket aktif." with a link to `/paket`.
- The points line no longer mentions WhatsApp.
- If the account previously bought agent, the Pembelian list still shows that purchase, still labelled "Agent". That is intended.
- The renewal banner at the top shows metadata renewals only (this was Task 3's `listPendingRenewals` filter — confirm it here with real data if you have any).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/finance/page.tsx"
git commit -m "feat: finance page drops the agent plan row, keeps agent purchase history"
```

---

### Task 9: Whole-change verification

**Files:** none — this task only runs things and records what it saw.

- [ ] **Step 1: Suite and build**

Run: `npm test`
Expected: green except the pre-existing failures recorded at the start. **If any `tests/lib/agent/**` file fails, stop** — the flag was supposed to gate surfaces only, and a failure there means agent logic was touched.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 2: Walk the public site** (`npm run dev`)

- [ ] `/` — single product, sections in the Task 6 order, navy reject band present, no invented statistics.
- [ ] Top nav = Fitur / Harga / FAQ. `Fitur` and `FAQ` scroll in-page; `Harga` goes to `/pricing`.
- [ ] `/metadata` → `/`. `/agent` → `/`.
- [ ] Footer has no Agent or Metadata link and its tagline does not say "pemilik bisnis".
- [ ] `/pricing` — no Agent tab, no lone product pill, duration switcher still works and discount badges still show.

- [ ] **Step 3: Walk the app as a tenant**

- [ ] Sidebar has no Agent group and no Toko group; Dashboard, Metadata › Riwayat, Akun & Tagihan › Paket & Harga + Finance are all present.
- [ ] `/dashboard` — points, plan, metadata counts, marketplace list, recent metadata, points history. No revenue, orders, stock, or sales chart.
- [ ] Neither `/dashboard` nor `/finance` claims points are for WhatsApp replies.
- [ ] `/paket` — metadata only.
- [ ] `/agent/chat` and `/agent/dashboard` by direct URL → `/dashboard`.
- [ ] `/produk` and `/transaksi` by direct URL still render (hidden, not removed).

- [ ] **Step 4: Probe the APIs**

```bash
curl -i -X POST http://localhost:3000/api/agent/chat -H 'content-type: application/json' -d '{}'
curl -i -X POST http://localhost:3000/api/agent/link -H 'content-type: application/json' -d '{}'
curl -i http://localhost:3000/api/agent/status
```

Expected: all three 403 with `{"ok":false,"error":"agent_disabled"}`.

- [ ] **Step 5: Prove the two things that must not break**

- [ ] The extension still generates: load the unpacked extension, open a marketplace upload form, generate one image, confirm the form fills and the point balance drops. `/api/extension/*` was not touched, so this must pass.
- [ ] The WhatsApp webhook still answers: send one message to the connected number and confirm a reply. If no test number is available, say so explicitly in the report rather than marking this done.

- [ ] **Step 6: Prove the switch reverses**

Set `AGENT_ENABLED = true` in `src/lib/features.ts`, run `npm run build`, and check: the two-product home page is back, `/agent` and `/metadata` render again, `/pricing` has the Agent tab, and the sidebar has the Agent and Toko groups.

**Then set it back to `false`** and confirm `git diff src/lib/features.ts` is empty. Shipping this file as `true` ships the thing we were hiding.

- [ ] **Step 7: Report**

Write up what was verified and what was not — specifically, that the home page and dashboard have no automated tests and were checked by eye, and whether the WhatsApp check in Step 5 actually ran. Do not describe untested pages as tested.

---

## Self-Review Notes

- **Spec coverage:** flag + nav (Task 1); pricing product list + single-product switcher (Task 2); order refusal incl. free activation, renewal skip, banner filter (Task 3); route redirects + API 403s, webhook/cron untouched (Task 4); home split preserving `HomeMultiProduct`, `/agent` redirect, footer (Task 5); the new landing incl. both new sections and the hero CTA change (Task 6); dashboard rebuild + extension onboarding state + points copy (Task 7); finance agent row, empty state, points copy, history left honest (Task 8); reversibility and the two must-not-break paths (Task 9).
- **Placeholder scan:** every code step carries the actual code. The one intentionally odd step is Task 5 Step 2's identical `if` branches, which is labelled as an intermediate state and replaced in Task 6 Step 6.
- **Type consistency:** `marketingNav`/`tenantNav` (Task 1) are used by name in Tasks 1's tests only; `pricingProducts(agentEnabled?)` keeps its return shape so `/pricing` and `/paket` need no edit; `getExtensionConnectionState` returns the three-variant union used verbatim by the dashboard in Task 7 Step 5; `MetadataLogStats.perMarketplace` and `.last7Days` match `src/lib/metadata-log.ts:76-80`; `submitOrder`'s `invalid_product` reason already exists in `SubmitOrderResult`.
- **Known gap, deliberate:** Tasks 5-8 change server components that this repo cannot unit-test. Their verification steps are manual and say so, and Task 9 Step 7 requires the final report to admit it.
- **Two things this plan must never break,** both checked in Task 9 Step 5: extension generate (`/api/extension/*` untouched) and the WhatsApp webhook.
