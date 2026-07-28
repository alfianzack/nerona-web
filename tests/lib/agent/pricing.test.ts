import { afterEach, describe, expect, it, vi } from "vitest";
import { costForUsage, pricingFromInput } from "@/lib/agent/pricing";

// Rates are passed in now (resolved from admin settings), so nothing here reads env.
const PRICING = { inPerMTok: 0.075, outPerMTok: 0.3, pointsPerUsd: 100_000 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("costForUsage", () => {
  it("computes ceil(usd * pointsPerUsd) from the configured rates", () => {
    // usd = 1500/1e6*0.075 + 350/1e6*0.30 = 0.0001125 + 0.000105 = 0.0002175
    // points = ceil(0.0002175 * 100000) = ceil(21.75) = 22
    const cost = costForUsage({
      usage: { promptTokens: 1500, completionTokens: 350 },
      pricing: PRICING,
    });
    expect(cost).toBe(22);
  });

  it("scales with a different pointsPerUsd", () => {
    const cost = costForUsage({
      usage: { promptTokens: 1500, completionTokens: 350 },
      pricing: { ...PRICING, pointsPerUsd: 1_000_000 },
    });
    expect(cost).toBe(218); // ceil(0.0002175 * 1e6) = ceil(217.5)
  });

  it("uses the configured per-model rates, not a hardcoded table", () => {
    // A pricier model: in $3/M, out $15/M.
    // usd = 1500/1e6*3 + 350/1e6*15 = 0.0045 + 0.00525 = 0.00975 → 975 points
    const cost = costForUsage({
      usage: { promptTokens: 1500, completionTokens: 350 },
      pricing: { inPerMTok: 3, outPerMTok: 15, pointsPerUsd: 100_000 },
    });
    expect(cost).toBe(975);
  });

  it("charges a minimum of 1 point for tiny usage", () => {
    const cost = costForUsage({
      usage: { promptTokens: 1, completionTokens: 1 },
      pricing: PRICING,
    });
    expect(cost).toBe(1);
  });

  it("still charges the 1-point floor when both rates are zero", () => {
    const cost = costForUsage({
      usage: { promptTokens: 1500, completionTokens: 350 },
      pricing: { inPerMTok: 0, outPerMTok: 0, pointsPerUsd: 100_000 },
    });
    expect(cost).toBe(1);
  });

  it("prices a ~1k-token reply at the configured out-rate when usage is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // 1000/1e6 * 0.30 * 100000 = 30
    expect(costForUsage({ usage: null, pricing: PRICING })).toBe(30);
    expect(warn).toHaveBeenCalled();
  });

  it("uses the same fallback when usage is present but all zero", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cost = costForUsage({
      usage: { promptTokens: 0, completionTokens: 0 },
      pricing: PRICING,
    });
    expect(cost).toBe(30);
  });
});

// What the admin panel previews as the operator types. Same rules as the server-side
// resolver, so the estimate on screen matches what the next call will cost.
describe("pricingFromInput", () => {
  const effective = { inPerMTok: 0.075, outPerMTok: 0.3, pointsPerUsd: 100_000 };

  it("uses the typed values", () => {
    expect(
      pricingFromInput({ priceIn: "3", priceOut: "15", pointsPerUsd: "50000" }, effective)
    ).toEqual({ inPerMTok: 3, outPerMTok: 15, pointsPerUsd: 50_000 });
  });

  it("falls back to the effective value for a blank field", () => {
    expect(pricingFromInput({ priceIn: "", priceOut: "  ", pointsPerUsd: "" }, effective)).toEqual(
      effective
    );
  });

  it("falls back for a non-numeric or negative field", () => {
    expect(
      pricingFromInput({ priceIn: "abc", priceOut: "-5", pointsPerUsd: "0" }, effective)
    ).toEqual(effective);
  });

  it("keeps a typed zero price", () => {
    expect(pricingFromInput({ priceIn: "0", priceOut: "", pointsPerUsd: "" }, effective).inPerMTok).toBe(0);
  });
});
