import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { aiModel: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
vi.mock("@/lib/ai-usage", () => ({ averageImageUsageByModel: vi.fn() }));

import { defaultModelPointsPerImage } from "@/lib/marketing-points";
import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai-settings";
import { averageImageUsageByModel } from "@/lib/ai-usage";

beforeEach(() => {
  vi.clearAllMocks();
  (getAiSettings as any).mockResolvedValue({
    model: "bawaan",
    pricing: { inPerMTok: 3, outPerMTok: 15, pointsPerUsd: 1000 },
  });
  (averageImageUsageByModel as any).mockResolvedValue(new Map());
});

/**
 * FAQ menjelaskan poin terpakai "tergantung gambar dan panjang teks yang
 * diproses" — jujur, tapi akibatnya "10 poin gratis" tidak berarti apa-apa
 * bagi pengunjung yang belum pernah memakai alatnya. Ia tidak bisa menilai
 * apakah paket Pro murah atau mahal, jadi ia menutup halaman.
 *
 * Angkanya TIDAK boleh diketik ke dalam teks. Tarif model bisa diubah owner
 * dari /admin kapan saja, dan angka yang disalin ke copy akan berbeda dari
 * yang benar-benar dipotong dari saldo dalam hitungan minggu. Jadi dihitung
 * saat request, lewat fungsi yang sama dengan yang menagih.
 */
describe("defaultModelPointsPerImage", () => {
  it("memakai tarif baris model bawaan, bukan tarif global", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue({
      id: "m1",
      inPerMTok: 3,
      outPerMTok: 15,
      // 2.600 token masuk × $3/MTok  = $0,0078
      //   400 token keluar × $15/MTok = $0,0060
      //                       total   = $0,0138 × 1.000 poin/USD = 13,8 → 14
    });

    expect(await defaultModelPointsPerImage()).toBe(14);
  });

  /**
   * Kalau model itu sudah punya cukup panggilan ber-gambar yang tercatat,
   * rata-rata NYATA menang atas profil acuan. Ini bedanya "perkiraan" dan
   * "perkiraan yang diikat ke tagihan yang sungguh-sungguh terjadi".
   */
  it("memakai pemakaian nyata kalau datanya sudah cukup", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue({
      id: "m1",
      inPerMTok: 3,
      outPerMTok: 15,
    });
    // 1.000 × $3/MTok = $0,003; 200 × $15/MTok = $0,003; total $0,006 → 6 poin
    (averageImageUsageByModel as any).mockResolvedValue(
      new Map([["m1", { promptTokens: 1_000, completionTokens: 200 }]])
    );

    expect(await defaultModelPointsPerImage()).toBe(6);
  });

  /**
   * Registri model kosong berarti tarif datang dari Koneksi AI. Halaman tetap
   * boleh menyebut angka — yang tidak boleh adalah menyebut angka yang bukan
   * dari rantai tarif yang sedang berlaku.
   */
  it("jatuh ke tarif Koneksi AI kalau belum ada baris model bawaan", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(null);

    expect(await defaultModelPointsPerImage()).toBe(14);
  });

  /**
   * Tanpa tarif yang masuk akal tidak ada angka yang layak dipajang. Diam
   * lebih baik daripada menebak: pemanggilnya menghilangkan seluruh kalimatnya,
   * bukan menampilkan "0 poin per gambar".
   */
  it("mengembalikan null kalau tarifnya belum diisi", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(null);
    (getAiSettings as any).mockResolvedValue({
      model: "bawaan",
      pricing: { inPerMTok: 0, outPerMTok: 0, pointsPerUsd: 0 },
    });

    expect(await defaultModelPointsPerImage()).toBeNull();
  });

  /** Basis data yang sedang tidak bisa dihubungi tidak boleh menjatuhkan beranda. */
  it("mengembalikan null alih-alih melempar saat query gagal", async () => {
    // Galatnya memang dicatat — itu perilaku yang diinginkan, bukan kebocoran.
    // Dibungkam di sini supaya keluaran uji tetap bersih dan galat yang TIDAK
    // disengaja tetap terlihat.
    const senyap = vi.spyOn(console, "error").mockImplementation(() => {});
    (prisma.aiModel.findFirst as any).mockRejectedValue(new Error("koneksi putus"));

    expect(await defaultModelPointsPerImage()).toBeNull();
    expect(senyap).toHaveBeenCalled();
    senyap.mockRestore();
  });
});

describe("gambarPerPoin", () => {
  /**
   * Angka yang benar-benar dibaca pengunjung. "10 poin" tidak berarti apa-apa;
   * "cukup untuk sekitar 5 gambar" langsung bisa ditimbang.
   */
  it("membagi jatah poin dengan ongkos per gambar, dibulatkan ke bawah", async () => {
    const { gambarPerPoin } = await import("@/lib/marketing-points");
    expect(gambarPerPoin(500, 14)).toBe(35);
    expect(gambarPerPoin(10, 14)).toBe(0);
  });

  it("mengembalikan null kalau ongkosnya tidak diketahui", async () => {
    const { gambarPerPoin } = await import("@/lib/marketing-points");
    expect(gambarPerPoin(500, null)).toBeNull();
  });
});
