import { describe, expect, it } from "vitest";

import { metadataFaq, metadataFaqBeranda } from "@/lib/marketing-faq";

const OPTS = { poinPerGambar: 2 };

/**
 * Pemecahan FAQ: enam di beranda, lengkapnya di /faq.
 *
 * Pada sebelas item, FAQ sendiri hampir sepertiga panjang beranda — dan
 * pertanyaan yang tersisa di beranda dipilih karena ia MENGHALANGI pembelian
 * (kartu kredit, privasi gambar, poin, pemasangan, pembayaran), bukan karena
 * ia sering ditanya.
 */
describe("pemecahan FAQ", () => {
  it("beranda memuat tepat enam pertanyaan", () => {
    expect(metadataFaqBeranda(OPTS)).toHaveLength(6);
  });

  /**
   * Satu daftar dengan penanda, BUKAN dua array. Dua array berarti jawaban
   * yang sama disalin dua kali, dan salinan kedua akan basi tanpa ada yang
   * tahu — persis kegagalan yang docblock marketing-faq.ts melarang.
   */
  it("beranda adalah bagian dari daftar penuh, bukan salinan terpisah", () => {
    const penuh = metadataFaq(OPTS);
    for (const item of metadataFaqBeranda(OPTS)) {
      expect(penuh).toContainEqual(item);
    }
  });

  it("daftar penuh lebih panjang daripada daftar beranda", () => {
    expect(metadataFaq(OPTS).length).toBeGreaterThan(metadataFaqBeranda(OPTS).length);
  });

  /**
   * Pengembalian dana adalah hal pertama yang dicari pembeli hati-hati ketika
   * pembayarannya transfer manual dan aksesnya "berlaku selamanya", dan
   * sebelum ini tidak ada di halaman mana pun.
   */
  it("daftar penuh menjawab pengembalian dana", () => {
    const teks = metadataFaq(OPTS)
      .map((i) => `${i.question} ${i.answer}`)
      .join("\n")
      .toLowerCase();
    expect(teks).toContain("pengembalian dana");
  });

  /** Lima yang pindah tidak boleh ikut tampil di beranda. */
  it("pertanyaan bahasa metadata tidak lagi di beranda", () => {
    const beranda = metadataFaqBeranda(OPTS)
      .map((i) => i.question)
      .join("\n");
    expect(beranda).not.toContain("berbahasa apa");
  });

  /**
   * Enam yang bertahan disebut satu per satu di sini. Tanpa ini, "tepat enam"
   * masih bisa dipenuhi oleh enam pertanyaan yang salah.
   */
  it("beranda memuat enam yang menghalangi pembelian", () => {
    const beranda = metadataFaqBeranda(OPTS)
      .map((i) => i.question)
      .join("\n");
    for (const potongan of [
      "kartu kredit",
      "Marketplace apa saja",
      "diunggah ke server",
      "Apa itu poin",
      "memasang ekstensi",
      "pembayaran",
    ]) {
      expect(beranda).toContain(potongan);
    }
  });
});
