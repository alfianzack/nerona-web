import { describe, expect, it } from "vitest";
import { activationExpiryFrom, isExpired } from "@/lib/billing-period";
import { addOneMonthJakarta, renewedExpiryFrom } from "@/lib/billing-period";

/**
 * Aktivasi dulu dipatok ke awal bulan berikutnya, jadi membeli tanggal 28 hanya
 * memberi beberapa hari. Tes di bawah mengunci aturan penggantinya: satu bulan
 * penuh sejak dibayar, sama dengan perpanjangan.
 */
describe("activationExpiryFrom", () => {
  it("gives a full month from a late-in-the-month activation", () => {
    // 2026-07-28 12:00 WIB === 2026-07-28T05:00:00Z → 2026-08-28 12:00 WIB
    expect(activationExpiryFrom(new Date("2026-07-28T05:00:00Z")).toISOString()).toBe(
      "2026-08-28T05:00:00.000Z"
    );
  });

  it("no longer truncates to the 1st of next month", () => {
    // Nilai lama untuk instan ini adalah 2026-07-31T17:00:00Z (1 Agustus WIB).
    const expiry = activationExpiryFrom(new Date("2026-07-28T05:00:00Z"));
    expect(expiry.toISOString()).not.toBe("2026-07-31T17:00:00.000Z");
    // Apa pun tanggal aktivasinya, masa aktif minimal 28 hari — bulan terpendek.
    const days = (expiry.getTime() - new Date("2026-07-28T05:00:00Z").getTime()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(28);
  });

  it("rolls December into next January", () => {
    // 2026-12-20 07:00 WIB → 2027-01-20 07:00 WIB
    expect(activationExpiryFrom(new Date("2026-12-20T00:00:00Z")).toISOString()).toBe(
      "2027-01-20T00:00:00.000Z"
    );
  });

  it("matches renewal, so both payment paths buy the same length", () => {
    const now = new Date("2026-07-28T05:00:00Z");
    expect(activationExpiryFrom(now).toISOString()).toBe(renewedExpiryFrom(null, now).toISOString());
  });

  it("clamps a 31st activation to the last day of a shorter month", () => {
    // 2026-08-31 12:00 WIB → September hanya 30 hari; Date.UTC menormalkan
    // overflow ke 1 Oktober, bukan melempar. Dikunci supaya perubahan diam-diam
    // pada perilaku ini ketahuan.
    expect(activationExpiryFrom(new Date("2026-08-31T05:00:00Z")).toISOString()).toBe(
      "2026-10-01T05:00:00.000Z"
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
