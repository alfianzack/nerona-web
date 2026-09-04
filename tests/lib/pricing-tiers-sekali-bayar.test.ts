import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findMany: vi.fn() },
    setting: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) },
  },
}));

import { metadataTiers } from "@/lib/pricing-tiers";
import { fullPriceLabel } from "@/components/marketing/PricingTiers";
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
    // Yang diperiksa adalah kalimat yang DIBACA pembeli. Angka dan
    // keterangannya kini dua kolom terpisah supaya kartu harga bisa sebaris,
    // jadi yang disatukan di sini persis yang disatukan di ringkasan checkout.
    const dibaca = fullPriceLabel(pro);
    expect(dibaca).not.toContain("/bulan");
    expect(dibaca).toContain("sekali bayar");
    expect(dibaca).toContain("79.000");
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

describe("metadataTiers — baris jatah poin", () => {
  /**
   * Kartu yang sama menulis "sekali bayar" di bawah angkanya dan "600 poin per
   * bulan" tujuh baris di bawahnya. Pembaca tidak bisa menyimpulkan mana yang
   * benar, dan pertanyaan itu justru yang menentukan apakah ia jadi transfer.
   *
   * Yang benar ada di kode: orders.ts memberi poin sekali per aktivasi, dan
   * lisensinya tanpa tanggal akhir. Jadi barisnya harus menyebut aktivasi,
   * bukan bulan.
   */
  it("paket berbayar tidak pernah menyebut per bulan", async () => {
    (prisma.plan.findMany as any).mockResolvedValue([
      { name: "Pro", priceMonthly: 79000, marketplaces: "*", rejectAnalyzer: false, hub: true },
    ]);

    const pro = (await metadataTiers()).find((t) => t.name === "Pro")!;
    const jatah = pro.features.map((f) => f.label).join(" | ");
    expect(jatah).not.toContain("per bulan");
    expect(jatah).toContain("poin");
  });

  /** Free tetap harus terbaca sebagai jatah seumur akun, bukan kuota berulang. */
  it("paket gratis tetap menyebut sekali per akun", async () => {
    (prisma.plan.findMany as any).mockResolvedValue([
      { name: "Free", priceMonthly: 0, marketplaces: "adobe", rejectAnalyzer: false, hub: false },
    ]);

    const free = (await metadataTiers()).find((t) => t.name === "Free")!;
    expect(free.features.map((f) => f.label).join(" | ")).toContain("sekali per akun");
  });

  /**
   * `months=` di URL order adalah sisa alur berdurasi. Ia tidak mengubah apa
   * pun lagi, tapi ia TERLIHAT — pembeli yang menaruh kursor di tombolnya
   * membaca "months=1" dan menyimpulkan ada bulan kedua yang harus dibayar.
   */
  it("tautan order tidak lagi membawa durasi", async () => {
    (prisma.plan.findMany as any).mockResolvedValue([
      { name: "Pro", priceMonthly: 79000, marketplaces: "*", rejectAnalyzer: false, hub: true },
    ]);

    const pro = (await metadataTiers()).find((t) => t.name === "Pro")!;
    expect(pro.href).not.toContain("months=");
    expect(pro.href).toContain("product=metadata");
    expect(pro.href).toContain("plan=Pro");
  });
});
