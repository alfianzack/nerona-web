import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { setting: { findMany: vi.fn(), upsert: vi.fn() } },
}));

import {
  DEFAULT_DURATION_DISCOUNTS,
  PLAN_DURATIONS,
  coerceDuration,
  getDurationDiscounts,
  isPlanDuration,
  priceForDuration,
  priceLabelFor,
  savingsLabelFor,
  updateDurationDiscount,
} from "@/lib/plan-duration";
import { parseRupiahInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const findMany = prisma.setting.findMany as any;
const upsert = prisma.setting.upsert as any;

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  for (const months of PLAN_DURATIONS) delete process.env[`DURATION_DISCOUNT_${months}`];
});

describe("coerceDuration", () => {
  it("accepts the four supported durations", () => {
    for (const months of PLAN_DURATIONS) expect(coerceDuration(String(months))).toBe(months);
  });

  it("falls back to monthly for anything else", () => {
    // Durasi datang dari query string, jadi ini adalah jalur yang dipakai
    // penyerang: 999 bulan gratis kalau nilainya diteruskan begitu saja.
    for (const bogus of [999, 0, -6, 2, "abc", null, undefined, {}]) {
      expect(coerceDuration(bogus)).toBe(1);
    }
    expect(isPlanDuration(999)).toBe(false);
  });
});

describe("getDurationDiscounts", () => {
  it("uses code defaults when nothing is stored", async () => {
    const discounts = await getDurationDiscounts();
    expect(discounts[6]).toBe(DEFAULT_DURATION_DISCOUNTS[6]);
  });

  it("prefers a stored value over env and default", async () => {
    process.env.DURATION_DISCOUNT_6 = "15";
    findMany.mockResolvedValue([{ key: "duration_discount_6", value: "25" }]);
    expect((await getDurationDiscounts())[6]).toBe(25);
  });

  it("ignores a stored value outside 0–100 rather than producing a negative price", async () => {
    findMany.mockResolvedValue([
      { key: "duration_discount_6", value: "150" },
      { key: "duration_discount_12", value: "-5" },
    ]);
    const discounts = await getDurationDiscounts();
    expect(discounts[6]).toBe(DEFAULT_DURATION_DISCOUNTS[6]);
    expect(discounts[12]).toBe(DEFAULT_DURATION_DISCOUNTS[12]);
  });

  it("keeps a stored zero — no discount is a real choice", async () => {
    findMany.mockResolvedValue([{ key: "duration_discount_6", value: "0" }]);
    expect((await getDurationDiscounts())[6]).toBe(0);
  });

  it("always reports monthly as undiscounted", async () => {
    findMany.mockResolvedValue([{ key: "duration_discount_1", value: "40" }]);
    // Diskon di durasi 1 bulan membuat "harga bulanan" yang diatur owner bukan
    // lagi harga yang dibayar siapa pun.
    expect((await getDurationDiscounts())[1]).toBe(0);
  });
});

describe("updateDurationDiscount", () => {
  it("stores a discount for a real duration", async () => {
    expect(await updateDurationDiscount(6, " 12 ")).toBe(true);
    expect(upsert).toHaveBeenCalledWith({
      where: { key: "duration_discount_6" },
      create: { key: "duration_discount_6", value: "12" },
      update: { value: "12" },
    });
  });

  it("refuses the monthly row and unknown durations", async () => {
    expect(await updateDurationDiscount(1, "10")).toBe(false);
    expect(await updateDurationDiscount(9, "10")).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("priceForDuration", () => {
  it("multiplies by the duration and applies the discount", () => {
    // 6 × 99.000 = 594.000, −10% = 534.600, dibulatkan ke ribuan = 535.000
    expect(priceForDuration(99_000, 6, 10)).toBe(535_000);
  });

  it("is the plain monthly price at one month with no discount", () => {
    expect(priceForDuration(99_000, 1, 0)).toBe(99_000);
  });

  it("stays free when the monthly price is zero", () => {
    expect(priceForDuration(0, 12, 20)).toBe(0);
  });
});

describe("priceLabelFor", () => {
  it("says Hubungi kami when no price is set — never Rp 0", () => {
    // "Rp 0" untuk paket berbayar yang harganya kosong terbaca sebagai gratis.
    expect(priceLabelFor(null, 6, 10)).toBe("Hubungi kami");
  });

  it("labels monthly and multi-month differently", () => {
    expect(priceLabelFor(99_000, 1, 0)).toBe("Rp 99.000/bulan");
    expect(priceLabelFor(99_000, 12, 20)).toBe("Rp 950.000/1 tahun");
  });
});

describe("savingsLabelFor", () => {
  it("shows the per-month equivalent and the amount saved", () => {
    expect(savingsLabelFor(99_000, 6, 10)).toBe("≈ Rp 89.167/bulan · hemat Rp 59.000");
  });

  it("is absent where it would say nothing useful", () => {
    expect(savingsLabelFor(99_000, 1, 0)).toBeNull();
    expect(savingsLabelFor(0, 6, 10)).toBeNull();
    expect(savingsLabelFor(null, 6, 10)).toBeNull();
  });
});

describe("parseRupiahInput", () => {
  it("accepts the shapes an owner actually types", () => {
    expect(parseRupiahInput("99000")).toBe(99_000);
    expect(parseRupiahInput("99.000")).toBe(99_000);
    expect(parseRupiahInput("Rp 99.000")).toBe(99_000);
    expect(parseRupiahInput("  rp99000 ")).toBe(99_000);
  });

  it("treats blank as a deliberate clear", () => {
    expect(parseRupiahInput("")).toBeNull();
    expect(parseRupiahInput("   ")).toBeNull();
  });

  it("rejects anything that is not a price", () => {
    for (const bad of ["gratis", "99rb", "-5000", "abc", "Rp"]) {
      expect(parseRupiahInput(bad)).toBeUndefined();
    }
  });
});
