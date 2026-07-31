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
