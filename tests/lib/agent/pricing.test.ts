import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_PRICING, costForUsage, pricingFromInput } from "@/lib/agent/pricing";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";

// Rates are passed in now (resolved from admin settings), so nothing here reads env.
// A local fixture on purpose — these numbers exercise the arithmetic and are not
// meant to track DEFAULT_AI_PRICING, which is asserted separately below.
const PRICING = { inPerMTok: 0.075, outPerMTok: 0.3, pointsPerUsd: 100_000 };

/** A representative call: a prompt plus a short reply. */
const TYPICAL_USAGE = { promptTokens: 1500, completionTokens: 350 };

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * AdminAiSettingsPanel says "Kosongkan untuk pakai default", so clearing the
 * three rate fields hands metering to DEFAULT_AI_PRICING. If those defaults are
 * not calibrated against the plan allowances, that documented affordance
 * silently disables every plan — which is exactly what happened once, when the
 * allowances were cut ~24x and the defaults were left behind.
 *
 * This is the guard against a repeat: it fails if either side moves out of step.
 */
describe("DEFAULT_AI_PRICING calibration", () => {
  it("leaves the Free metadata allowance able to pay for several calls", () => {
    const cost = costForUsage({ usage: TYPICAL_USAGE, pricing: DEFAULT_AI_PRICING });

    expect(cost).toBeLessThanOrEqual(DEFAULT_PLAN_POINTS.metadata.free);
    expect(cost).toBeGreaterThan(0);
  });

  it("keeps a paid plan worth buying — Pro affords at least 100 calls", () => {
    const cost = costForUsage({ usage: TYPICAL_USAGE, pricing: DEFAULT_AI_PRICING });

    expect(DEFAULT_PLAN_POINTS.metadata.pro / cost).toBeGreaterThanOrEqual(100);
  });

  it("charges the missing-usage fallback within the Free allowance too", () => {
    // No usage reported: costForUsage prices a ~1k-token reply rather than
    // charging nothing. That path must stay affordable as well.
    const cost = costForUsage({ usage: null, pricing: DEFAULT_AI_PRICING });

    expect(cost).toBeLessThanOrEqual(DEFAULT_PLAN_POINTS.metadata.free);
  });
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
