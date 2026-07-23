import { describe, expect, it } from "vitest";
import { monthlyExpiryFrom, isExpired } from "@/lib/billing-period";
import { addOneMonthJakarta, renewedExpiryFrom } from "@/lib/billing-period";

describe("monthlyExpiryFrom", () => {
  it("returns next month 1st 00:00 WIB (UTC+7) for a mid-month date", () => {
    // 2026-07-15 12:00 WIB === 2026-07-15T05:00:00Z
    // Aug 1 00:00 WIB === 2026-07-31T17:00:00Z
    expect(monthlyExpiryFrom(new Date("2026-07-15T05:00:00Z")).toISOString()).toBe(
      "2026-07-31T17:00:00.000Z"
    );
  });

  it("rolls December into next January", () => {
    // 2026-12-20 07:00 WIB === 2026-12-20T00:00:00Z → Jan 1 2027 00:00 WIB === 2026-12-31T17:00:00Z
    expect(monthlyExpiryFrom(new Date("2026-12-20T00:00:00Z")).toISOString()).toBe(
      "2026-12-31T17:00:00.000Z"
    );
  });

  it("at the month boundary instant, targets the following month end", () => {
    // 2026-07-31T17:00:00Z === Aug 1 00:00 WIB → next boundary Sep 1 00:00 WIB === 2026-08-31T17:00:00Z
    expect(monthlyExpiryFrom(new Date("2026-07-31T17:00:00Z")).toISOString()).toBe(
      "2026-08-31T17:00:00.000Z"
    );
  });
});

describe("isExpired", () => {
  const now = new Date("2026-07-15T00:00:00Z");
  it("is false for null", () => expect(isExpired(null, now)).toBe(false));
  it("is false for a future date", () => expect(isExpired(new Date("2026-08-01T00:00:00Z"), now)).toBe(false));
  it("is true for a past date", () => expect(isExpired(new Date("2026-07-01T00:00:00Z"), now)).toBe(true));
  it("is true at the exact instant", () => expect(isExpired(now, now)).toBe(true));
});

describe("addOneMonthJakarta", () => {
  it("advances a month-boundary instant to the next month boundary", () => {
    // 2026-07-31T17:00:00Z === Aug 1 00:00 WIB → +1mo → Sep 1 00:00 WIB === 2026-08-31T17:00:00Z
    expect(addOneMonthJakarta(new Date("2026-07-31T17:00:00Z")).toISOString()).toBe(
      "2026-08-31T17:00:00.000Z"
    );
  });
  it("advances a mid-month instant by one calendar month (same day/time WIB)", () => {
    // 2026-07-10T05:00:00Z === Jul 10 12:00 WIB → Aug 10 12:00 WIB === 2026-08-10T05:00:00Z
    expect(addOneMonthJakarta(new Date("2026-07-10T05:00:00Z")).toISOString()).toBe(
      "2026-08-10T05:00:00.000Z"
    );
  });
  it("rolls December into next January", () => {
    // 2026-12-15T00:00:00Z === Dec 15 07:00 WIB → Jan 15 2027 07:00 WIB === 2027-01-15T00:00:00Z
    expect(addOneMonthJakarta(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe(
      "2027-01-15T00:00:00.000Z"
    );
  });
});

describe("renewedExpiryFrom", () => {
  it("forward-stacks from a still-future expiry", () => {
    // current Aug 1 00:00 WIB (2026-07-31T17:00Z), now before it → base=current → Sep 1 00:00 WIB
    expect(
      renewedExpiryFrom(new Date("2026-07-31T17:00:00Z"), new Date("2026-07-20T00:00:00Z")).toISOString()
    ).toBe("2026-08-31T17:00:00.000Z");
  });
  it("extends from now when expiry is null", () => {
    expect(renewedExpiryFrom(null, new Date("2026-07-10T05:00:00Z")).toISOString()).toBe(
      "2026-08-10T05:00:00.000Z"
    );
  });
  it("extends from now when already lapsed", () => {
    expect(
      renewedExpiryFrom(new Date("2026-06-30T17:00:00Z"), new Date("2026-07-10T05:00:00Z")).toISOString()
    ).toBe("2026-08-10T05:00:00.000Z");
  });
});
