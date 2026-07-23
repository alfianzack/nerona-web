import { describe, expect, it } from "vitest";
import { isAgentPlanExpired } from "@/lib/agent/admin";

const now = new Date("2026-07-15T00:00:00Z");
const past = new Date("2026-07-01T00:00:00Z");
const future = new Date("2026-08-01T00:00:00Z");

describe("isAgentPlanExpired", () => {
  it("true for a paid plan past its expiry", () => {
    expect(isAgentPlanExpired({ plan: "pro", planExpiresAt: past }, now)).toBe(true);
  });
  it("false for a paid plan not yet expired", () => {
    expect(isAgentPlanExpired({ plan: "business", planExpiresAt: future }, now)).toBe(false);
  });
  it("false for a paid plan with null expiry (legacy grandfathered)", () => {
    expect(isAgentPlanExpired({ plan: "pro", planExpiresAt: null }, now)).toBe(false);
  });
  it("false for the free plan even with a past date", () => {
    expect(isAgentPlanExpired({ plan: "free", planExpiresAt: past }, now)).toBe(false);
  });
});
