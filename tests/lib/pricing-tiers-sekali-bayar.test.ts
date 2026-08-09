import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findMany: vi.fn() },
    setting: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) },
  },
}));

import { metadataTiers } from "@/lib/pricing-tiers";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.setting.findMany as any).mockResolvedValue([]);
  (prisma.setting.findUnique as any).mockResolvedValue(null);
});

describe("metadataTiers — alur sekali bayar", () => {
  /**
   * "/bulan" menjanjikan penagihan bulanan yang tidak pernah terjadi. Salah
   * paham semacam itu tidak berakhir di pertanyaan — ia berakhir di permintaan
   * pengembalian uang.
   */
  it("label harga menyebut sekali bayar, bukan per bulan", async () => {
    (prisma.plan.findMany as any).mockResolvedValue([
      { name: "Pro", priceMonthly: 79000, marketplaces: "*", rejectAnalyzer: true, hub: false },
    ]);

    const pro = (await metadataTiers()).find((t) => t.name === "Pro")!;
    expect(pro.priceLabel).not.toContain("/bulan");
    expect(pro.priceLabel).toContain("sekali bayar");
    expect(pro.priceLabel).toContain("79.000");
    expect(pro.savingsLabel).toBeNull();
  });

  /**
   * Harga tidak boleh ikut dikalikan durasi lagi. Kalau ia mengalikan, pembeli
   * membayar 79.000 × 12 untuk sesuatu yang dijanjikan 79.000.
   */
  it("durasi yang diminta pemanggil tidak mengubah harga", async () => {
    (prisma.plan.findMany as any).mockResolvedValue([
      { name: "Pro", priceMonthly: 79000, marketplaces: "*", rejectAnalyzer: true, hub: false },
    ]);

    const satu = (await metadataTiers(1)).find((t) => t.name === "Pro")!;
    const duabelas = (await metadataTiers(12)).find((t) => t.name === "Pro")!;
    expect(duabelas.priceLabel).toBe(satu.priceLabel);
  });

  it("paket gratis dan paket tanpa harga tetap punya labelnya sendiri", async () => {
    (prisma.plan.findMany as any).mockResolvedValue([
      { name: "Free", priceMonthly: 0, marketplaces: "adobe", rejectAnalyzer: false, hub: false },
      { name: "Business", priceMonthly: null, marketplaces: "*", rejectAnalyzer: true, hub: true },
    ]);

    const tiers = await metadataTiers();
    expect(tiers.find((t) => t.name === "Free")!.priceLabel).toBe("Gratis");
    expect(tiers.find((t) => t.name === "Business")!.priceLabel).toBe("Hubungi kami");
  });
});
