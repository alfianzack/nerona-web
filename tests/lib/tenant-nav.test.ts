import { describe, expect, it } from "vitest";

import { CUSTOMER_NAV } from "@/components/layout/Header";
import { activeHref } from "@/components/layout/HeaderNav";

/**
 * Signing in swaps the guest nav (which carries the marketing pages) for
 * CUSTOMER_NAV. Anything a tenant needs but cannot reach from here is
 * effectively invisible — that has already shipped twice, once for /pricing and
 * once for the agent chat. These tests pin the entry points.
 */
describe("tenant navigation", () => {
  const hrefs = CUSTOMER_NAV.map((item) => item.href);

  it("lets a tenant reach the agent chat", () => {
    expect(hrefs).toContain("/agent/chat");
  });

  it("lets a tenant reach pricing to buy Agent or Metadata", () => {
    expect(hrefs).toContain("/pricing");
  });

  it("has no duplicate destinations", () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("highlights the agent tab on its sub-pages, not the dashboard tab", () => {
    expect(activeHref("/agent/chat", CUSTOMER_NAV)).toBe("/agent/chat");
    expect(activeHref("/dashboard", CUSTOMER_NAV)).toBe("/dashboard");
  });
});
