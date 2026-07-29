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
