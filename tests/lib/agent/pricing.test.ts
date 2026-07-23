import { afterEach, describe, expect, it, vi } from "vitest";
import { costForUsage } from "@/lib/agent/pricing";

afterEach(() => {
  delete process.env.POINTS_PER_USD;
  vi.restoreAllMocks();
});

describe("costForUsage", () => {
  it("computes ceil(usd * POINTS_PER_USD) for a known model", () => {
    // gemini-2.0-flash-lite: in $0.075/M, out $0.30/M
    // usd = 1500/1e6*0.075 + 350/1e6*0.30 = 0.0001125 + 0.000105 = 0.0002175
    // points = ceil(0.0002175 * 100000) = ceil(21.75) = 22
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: { promptTokens: 1500, completionTokens: 350 } });
    expect(cost).toBe(22);
  });

  it("respects a POINTS_PER_USD override", () => {
    process.env.POINTS_PER_USD = "1000000";
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: { promptTokens: 1500, completionTokens: 350 } });
    expect(cost).toBe(218); // ceil(0.0002175 * 1e6) = ceil(217.5)
  });

  it("falls back to the default price for an unknown model", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cost = costForUsage({ model: "mystery-model", usage: { promptTokens: 1500, completionTokens: 350 } });
    expect(cost).toBe(22); // same as flash-lite default
    expect(warn).toHaveBeenCalled();
  });

  it("charges a minimum of 1 point for tiny usage", () => {
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: { promptTokens: 1, completionTokens: 1 } });
    expect(cost).toBe(1);
  });

  it("charges a conservative default when usage is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cost = costForUsage({ model: "gemini-2.0-flash-lite", usage: null });
    expect(cost).toBeGreaterThanOrEqual(1);
    expect(warn).toHaveBeenCalled();
  });
});
