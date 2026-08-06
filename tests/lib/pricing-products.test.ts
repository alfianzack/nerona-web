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
