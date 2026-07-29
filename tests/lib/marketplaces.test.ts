import { describe, expect, it } from "vitest";

import { CLAIMABLE_MARKETPLACES, MARKETPLACES, describeMarketplaces } from "@/lib/marketplaces";

/**
 * A hardcoded copy of the extension's ALL_MARKETPLACES (nerona_medata
 * access/access.js). Duplicated on purpose: the two repositories ship
 * separately, so the only way a rename on either side can be caught is for this
 * list to be asserted against, not imported. If this test fails, do not edit
 * this array to match — check which side changed and whether a plan storing the
 * old key would now be denied a marketplace it grants.
 */
const EXTENSION_MARKETPLACES = [
  "adobe",
  "magnific",
  "vecteezy",
  "shutterstock",
  "canva",
  "miricanvas",
  "designbundle",
  "dreamstime",
];

describe("MARKETPLACES", () => {
  it("uses exactly the keys the extension recognises", () => {
    expect([...MARKETPLACES].map((m) => m.key).sort()).toEqual([...EXTENSION_MARKETPLACES].sort());
  });
});

describe("CLAIMABLE_MARKETPLACES", () => {
  it("names seven marketplaces and excludes the unproven Design Bundles", () => {
    const keys = CLAIMABLE_MARKETPLACES.map((m) => m.key);

    expect(keys).toHaveLength(7);
    expect(keys).not.toContain("designbundle");
  });

  it("is a subset of the functional registry", () => {
    const registry = new Set([...MARKETPLACES].map((m) => m.key));

    for (const marketplace of CLAIMABLE_MARKETPLACES) {
      expect(registry.has(marketplace.key)).toBe(true);
    }
  });
});

describe("describeMarketplaces", () => {
  it('reports only the claimable count for "*"', () => {
    expect(describeMarketplaces("*")).toBe("Semua 7 marketplace");
  });

  it("lists exactly the labels asked for", () => {
    expect(describeMarketplaces("adobe,shutterstock")).toBe("Adobe Stock, Shutterstock");
  });

  it("tolerates whitespace around keys", () => {
    expect(describeMarketplaces(" adobe , canva ")).toBe("Adobe Stock, Canva");
  });

  it("ignores an unknown key rather than throwing", () => {
    expect(describeMarketplaces("adobe,nosuchplace")).toBe("Adobe Stock");
  });

  /**
   * Design Bundles stays out of marketing copy but a plan may still grant it, so
   * naming it explicitly must still describe it — otherwise an admin who
   * restricts a plan to it sees a blank feature row.
   */
  it("still names Design Bundles when a plan grants it explicitly", () => {
    expect(describeMarketplaces("designbundle")).toBe("Design Bundles");
  });
});
