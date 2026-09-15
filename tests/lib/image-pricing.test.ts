import { describe, expect, it } from "vitest";

import { costForImage } from "@/lib/agent/pricing";

/**
 * Harga gambar berbeda jenis dari harga metadata, dan itu yang diuji di sini.
 *
 * Metadata ditagih per token, jadi angkanya selalu perkiraan sampai balasannya
 * kembali. Generator gambar ditagih per gambar, jadi ongkosnya sudah pasti
 * SEBELUM tombolnya diklik. Layarnya menjanjikan angka pasti kepada tenant, dan
 * janji itu hanya sah kalau fungsinya benar-benar tidak bergantung pada apa pun
 * selain tarif barisnya.
 */
describe("costForImage", () => {
  it("mengalikan tarif per gambar dengan pointsPerUsd", () => {
    // 0,04 USD x 1000 poin per USD = 40 poin.
    expect(costForImage({ usdPerImage: 0.04, pointsPerUsd: 1000 })).toBe(40);
  });

  it("membulatkan ke atas, karena poin bilangan bulat", () => {
    // 0,0035 x 1000 = 3,5 -> 4. Membulatkan ke bawah berarti Nerona menanggung
    // selisihnya di setiap gambar, dan selisih itu tidak pernah terlihat.
    expect(costForImage({ usdPerImage: 0.0035, pointsPerUsd: 1000 })).toBe(4);
  });

  it("tidak pernah menagih nol untuk pekerjaan yang benar-benar dilakukan", () => {
    // Tarif yang sangat murah tetap satu poin. Nol poin berarti tenant bisa
    // menghabiskan kuota provider tanpa saldonya bergerak sama sekali.
    expect(costForImage({ usdPerImage: 0.0000001, pointsPerUsd: 1000 })).toBe(1);
  });

  it("menolak tarif yang belum diisi, bukan diam-diam menganggapnya gratis", () => {
    // Kolom usdPerImage nullable karena baris chat tidak memakainya. Baris image
    // tanpa tarif adalah kesalahan konfigurasi, dan menagih 0 poin untuknya akan
    // menyembunyikan kesalahan itu sampai tagihan provider datang.
    expect(() => costForImage({ usdPerImage: null, pointsPerUsd: 1000 })).toThrow(
      /tarif per gambar/i
    );
    expect(() => costForImage({ usdPerImage: 0, pointsPerUsd: 1000 })).toThrow(
      /tarif per gambar/i
    );
  });

  it("menolak pointsPerUsd yang belum diisi", () => {
    expect(() => costForImage({ usdPerImage: 0.04, pointsPerUsd: 0 })).toThrow(
      /pointsPerUsd/i
    );
  });
});
