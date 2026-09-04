import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { plan: { findMany: vi.fn() } },
}));

import { rejectAnalyzerAvailability } from "@/lib/marketing-plans";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Audit halaman jualan menemukan "Tersedia di paket Business" tertulis di dua
 * tempat sementara tabel harga — yang membaca kolom `rejectAnalyzer` dari
 * basis data — mencentangnya di ketiga paket. Satu dari keduanya pasti salah,
 * dan pengunjung menemukan kontradiksinya dalam satu gulir.
 *
 * Membetulkan barisnya di basis data hanya membetulkan kejadian hari ini.
 * Kalimat yang diketik tangan akan menyimpang lagi pada suntingan /admin
 * berikutnya, dan tidak ada yang akan menyadarinya — persis kebiasaan yang
 * docblock marketing-faq.ts sudah tuliskan tapi belum diberlakukan di sini.
 * Jadi yang diuji adalah TURUNANNYA, bukan hasil suntingannya.
 */
describe("rejectAnalyzerAvailability", () => {
  function mockPlans(rows: Array<{ name: string; rejectAnalyzer: boolean }>) {
    (prisma.plan.findMany as any).mockResolvedValue(rows);
  }

  it("menyebut satu paket saat hanya satu yang punya", async () => {
    mockPlans([
      { name: "Free", rejectAnalyzer: false },
      { name: "Pro", rejectAnalyzer: false },
      { name: "Business", rejectAnalyzer: true },
    ]);

    const hasil = await rejectAnalyzerAvailability();
    expect(hasil.plans).toEqual(["Business"]);
    expect(hasil.note).toBe("Tersedia di paket Business");
  });

  it("merangkai dua paket dengan “dan”", async () => {
    mockPlans([
      { name: "Free", rejectAnalyzer: false },
      { name: "Pro", rejectAnalyzer: true },
      { name: "Business", rejectAnalyzer: true },
    ]);

    const hasil = await rejectAnalyzerAvailability();
    expect(hasil.note).toBe("Tersedia di paket Pro dan Business");
  });

  /** Urutannya mengikuti tabel harga, bukan urutan baris yang dikembalikan DB. */
  it("mengurutkan seperti tabel harga, bukan seperti hasil query", async () => {
    mockPlans([
      { name: "Business", rejectAnalyzer: true },
      { name: "Pro", rejectAnalyzer: true },
      { name: "Free", rejectAnalyzer: true },
    ]);

    const hasil = await rejectAnalyzerAvailability();
    expect(hasil.plans).toEqual(["Free", "Pro", "Business"]);
  });

  /**
   * Kalau semua paket punya, tidak ada yang perlu disyaratkan. Menulis
   * "Tersedia di paket Free, Pro, dan Business" membuat pembaca mencari
   * batasan yang tidak ada — dan justru menanam keraguan yang tadinya tidak
   * dimilikinya.
   */
  it("tidak memberi syarat kalau semua paket punya", async () => {
    mockPlans([
      { name: "Free", rejectAnalyzer: true },
      { name: "Pro", rejectAnalyzer: true },
      { name: "Business", rejectAnalyzer: true },
    ]);

    const hasil = await rejectAnalyzerAvailability();
    expect(hasil.plans).toHaveLength(3);
    expect(hasil.note).toBeNull();
  });

  /**
   * Nol paket berarti fiturnya tidak dijual sama sekali hari ini. Pemanggilnya
   * memakai `plans.length` untuk menyembunyikan seluruh bagiannya — memasang
   * bagian penuh untuk sesuatu yang tidak bisa dibeli siapa pun adalah bentuk
   * ketidakjujuran yang paling mahal di halaman ini.
   */
  it("mengembalikan daftar kosong kalau tidak ada paket yang punya", async () => {
    mockPlans([
      { name: "Free", rejectAnalyzer: false },
      { name: "Pro", rejectAnalyzer: false },
    ]);

    const hasil = await rejectAnalyzerAvailability();
    expect(hasil.plans).toEqual([]);
    expect(hasil.note).toBeNull();
  });
});
