import { describe, expect, it } from "vitest";

import { metadataFaq } from "@/lib/marketing-faq";

function gabung(items: { question: string; answer: string }[]): string {
  return items.map((i) => `${i.question} ${i.answer}`).join("\n");
}

/**
 * FAQ beranda ketinggalan saat produk pindah ke alur sekali bayar. Halaman
 * /pricing sudah benar — "Paket dibeli sekali dan aksesnya berlaku selamanya"
 * — sementara beranda masih menawarkan "memperpanjang paket", dan keduanya
 * dibaca orang yang sama dalam satu kunjungan.
 */
describe("metadataFaq — alur sekali bayar", () => {
  it("tidak lagi menawarkan perpanjangan paket", () => {
    const teks = gabung(metadataFaq({ poinPerGambar: null }));
    expect(teks).not.toContain("memperpanjang");
  });

  it("menjawab pertanyaan tagihan bulanan secara eksplisit", () => {
    const teks = gabung(metadataFaq({ poinPerGambar: null }));
    expect(teks).toContain("tagihan bulanan");
  });
});

describe("metadataFaq — patokan poin", () => {
  /**
   * Tanpa patokan, "10 poin gratis" tidak bisa ditimbang siapa pun yang belum
   * memakai alatnya.
   */
  it("menyebut ongkos per gambar kalau angkanya diketahui", () => {
    const teks = gabung(metadataFaq({ poinPerGambar: 3 }));
    expect(teks).toContain("3 poin");
  });

  /**
   * Kalau tarifnya belum bisa dihitung, kalimatnya hilang — bukan diganti
   * tebakan. Halaman ini punya aturan tertulis untuk itu: kalau ragu, KURANGI.
   */
  it("tidak mengarang angka saat ongkosnya tidak diketahui", () => {
    const teks = gabung(metadataFaq({ poinPerGambar: null }));
    expect(teks).not.toMatch(/\d+ poin per gambar/);
    // Pertanyaannya tetap ada — yang hilang cuma patokannya.
    expect(teks).toContain("Apa itu poin");
  });
});
