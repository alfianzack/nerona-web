import { describe, expect, it } from "vitest";
import { computeLicenseStatus, PAST_DUE_GRACE_MS } from "@/lib/license-status";

describe("computeLicenseStatus", () => {
  it("is active when the subscription is active", () => {
    const result = computeLicenseStatus({
      subscriptionStatus: "active",
      pastDueSince: null,
      now: new Date("2026-01-10"),
    });
    expect(result).toBe("active");
  });

  it("is active when the subscription is trialing", () => {
    const result = computeLicenseStatus({
      subscriptionStatus: "trialing",
      pastDueSince: null,
      now: new Date("2026-01-10"),
    });
    expect(result).toBe("active");
  });

  it("is active when past_due and still within the grace period", () => {
    const pastDueSince = new Date("2026-01-10T00:00:00Z");
    const now = new Date(pastDueSince.getTime() + PAST_DUE_GRACE_MS - 1000);
    const result = computeLicenseStatus({ subscriptionStatus: "past_due", pastDueSince, now });
    expect(result).toBe("active");
  });

  it("is expired when past_due and past the grace period", () => {
    const pastDueSince = new Date("2026-01-10T00:00:00Z");
    const now = new Date(pastDueSince.getTime() + PAST_DUE_GRACE_MS + 1000);
    const result = computeLicenseStatus({ subscriptionStatus: "past_due", pastDueSince, now });
    expect(result).toBe("expired");
  });

  it("is expired when canceled", () => {
    const result = computeLicenseStatus({
      subscriptionStatus: "canceled",
      pastDueSince: null,
      now: new Date("2026-01-10"),
    });
    expect(result).toBe("expired");
  });
});
