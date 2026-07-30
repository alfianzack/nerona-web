import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { setting: { findUnique: vi.fn(), upsert: vi.fn() } },
}));

import {
  DEFAULT_TOPUP_PACKAGES,
  formatTopupPackages,
  getTopupPackages,
  parseTopupPackages,
  perPointLabel,
  topupLabel,
  updateTopupPackages,
} from "@/lib/topup";
import { prisma } from "@/lib/prisma";

const findUnique = prisma.setting.findUnique as any;
const upsert = prisma.setting.upsert as any;

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
});

describe("parseTopupPackages", () => {
  it("reads one package per line", () => {
    expect(parseTopupPackages("500=25000\n1000=45000")).toEqual([
      { points: 500, price: 25_000 },
      { points: 1000, price: 45_000 },
    ]);
  });

  it("tolerates thousand separators and stray spacing", () => {
    expect(parseTopupPackages(" 1.000 = 45.000 ")).toEqual([{ points: 1000, price: 45_000 }]);
  });

  it("sorts by point amount so the buy page reads small to large", () => {
    const parsed = parseTopupPackages("5000=200000\n500=25000")!;
    expect(parsed.map((p) => p.points)).toEqual([500, 5000]);
  });

  it("returns null for blank input so the caller can fall back to defaults", () => {
    expect(parseTopupPackages("")).toBeNull();
    expect(parseTopupPackages("   \n  ")).toBeNull();
  });

  it("rejects a malformed list rather than silently dropping lines", () => {
    // Satu baris rusak berarti daftar harganya tidak seperti yang dikira owner.
    // Menerima sebagian diam-diam adalah cara termudah menjual harga yang salah.
    expect(parseTopupPackages("500=25000\nseribu poin")).toBeNull();
    expect(parseTopupPackages("500")).toBeNull();
    expect(parseTopupPackages("500=25000=1")).toBeNull();
  });

  it("rejects zero or negative amounts", () => {
    expect(parseTopupPackages("0=25000")).toBeNull();
    expect(parseTopupPackages("500=0")).toBeNull();
    expect(parseTopupPackages("-500=25000")).toBeNull();
  });

  it("rejects duplicate point amounts — two identical rows are indistinguishable", () => {
    expect(parseTopupPackages("500=25000\n500=30000")).toBeNull();
  });
});

describe("getTopupPackages", () => {
  it("falls back to the code defaults when unset", async () => {
    expect(await getTopupPackages()).toEqual(DEFAULT_TOPUP_PACKAGES);
  });

  it("falls back when the stored value is unreadable rather than selling nothing", async () => {
    findUnique.mockResolvedValue({ value: "rusak" });
    expect(await getTopupPackages()).toEqual(DEFAULT_TOPUP_PACKAGES);
  });

  it("uses the stored list when it parses", async () => {
    findUnique.mockResolvedValue({ value: "200=10000" });
    expect(await getTopupPackages()).toEqual([{ points: 200, price: 10_000 }]);
  });
});

describe("updateTopupPackages", () => {
  it("stores a valid list", async () => {
    expect(await updateTopupPackages("500=25000")).toEqual({ ok: true });
    expect(upsert.mock.calls[0][0].update).toEqual({ value: "500=25000" });
  });

  it("accepts empty as a deliberate reset to defaults", async () => {
    expect(await updateTopupPackages("  ")).toEqual({ ok: true });
    expect(upsert.mock.calls[0][0].update).toEqual({ value: "" });
  });

  it("refuses to store a list it cannot read back", async () => {
    expect(await updateTopupPackages("500")).toEqual({ ok: false, reason: "invalid" });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("labels", () => {
  it("names a package by its point count", () => {
    expect(topupLabel(1000)).toBe("1.000 poin");
  });

  it("shows the per-point rate so bigger packages look better", () => {
    expect(perPointLabel({ points: 500, price: 25_000 })).toBe("≈ Rp 50/poin");
  });

  it("avoids Rp 0/poin when a point costs less than a rupiah", () => {
    const label = perPointLabel({ points: 100_000, price: 50_000 });
    expect(label).not.toContain("Rp 0/poin");
    expect(label).toContain("100.000 poin");
  });

  it("round-trips through formatTopupPackages", () => {
    expect(parseTopupPackages(formatTopupPackages(DEFAULT_TOPUP_PACKAGES))).toEqual(
      DEFAULT_TOPUP_PACKAGES
    );
  });
});
