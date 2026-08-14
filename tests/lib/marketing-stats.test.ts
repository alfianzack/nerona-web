import { describe, it, expect } from "vitest";
import { bulatkanKeBawah } from "@/lib/marketing-stats";

/**
 * Arah pembulatannya yang diuji, bukan sekadar formatnya.
 *
 * Angka di halaman pemasaran harus salah ke arah yang aman: kalau meleset,
 * meleset karena terlalu sedikit. Itu kebijakan yang sama dengan under-claim
 * jumlah marketplace di lib/marketplaces.ts, dan sebuah bug yang membulatkan ke
 * ATAS akan mengubah angka jujur jadi klaim yang tidak bisa dipertahankan tanpa
 * ada yang menyadarinya.
 */
describe("bulatkanKeBawah", () => {
  it("tidak pernah membulatkan ke atas", () => {
    for (const nilai of [1_001, 1_999, 12_480, 999_999, 1_099_999]) {
      const teks = bulatkanKeBawah(nilai);
      const angka = Number(teks.replace(/[^\d,]/g, "").replace(",", "."));
      const skala = teks.includes("juta") ? 1_000_000 : 1;
      expect(angka * skala).toBeLessThanOrEqual(nilai);
    }
  });

  it("memangkas ke ribuan penuh di bawah satu juta", () => {
    expect(bulatkanKeBawah(12_480)).toBe("12.000+");
    expect(bulatkanKeBawah(1_000)).toBe("1.000+");
    expect(bulatkanKeBawah(999_999)).toBe("999.000+");
  });

  it("beralih ke juta dengan satu angka di belakang koma", () => {
    expect(bulatkanKeBawah(1_000_000)).toBe("1 juta+");
    expect(bulatkanKeBawah(15_480_000)).toBe("15,4 juta+");
    expect(bulatkanKeBawah(1_099_999)).toBe("1 juta+");
  });

  it("membiarkan angka di bawah seribu apa adanya", () => {
    // Angka sekecil ini seharusnya tidak pernah sampai ke halaman — gerbang di
    // getMarketingStats menahannya jauh sebelum ini. Diuji supaya kalau
    // gerbangnya suatu saat dilepas, hasilnya tetap angka jujur, bukan "0+".
    expect(bulatkanKeBawah(0)).toBe("0");
    expect(bulatkanKeBawah(412)).toBe("412");
  });
});
