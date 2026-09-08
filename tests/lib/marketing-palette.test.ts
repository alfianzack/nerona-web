import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Penjaga kontras palet pemasaran.
 *
 * Redesign beranda menambahkan satu warna aksi hangat, dan amber punya sifat
 * yang membuat kesalahannya lolos dari mata: #F2A93B cukup terang sehingga
 * teks putih di atasnya hanya sekitar 2:1, dan cukup gelap sehingga ia sendiri
 * gagal sebagai teks di atas putih. Dua kesalahan itu terlihat "kurang tegas"
 * di layar, bukan terlihat salah — jadi yang menangkapnya harus angka.
 *
 * Berkas CSS-nya dibaca apa adanya, bukan nilainya disalin ke tes: yang perlu
 * dijaga adalah nilai yang benar-benar dikirim ke peramban, termasuk kalau
 * seseorang menyuntingnya nanti tanpa membaca spec.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");

/** Isi blok token permukaan pemasaran, dipotong dari berkasnya. */
function marketingBlock(): string {
  const start = CSS.indexOf('[data-surface="marketing"]');
  expect(start).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    if (CSS[i] === "}") {
      depth--;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error("blok token pemasaran tidak tertutup");
}

/** Token ditulis sebagai kanal RGB dipisah spasi — lihat docblock globals.css. */
function token(name: string): [number, number, number] {
  const found = marketingBlock().match(
    new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`)
  );
  if (!found) throw new Error(`token --${name} tidak ada di permukaan pemasaran`);
  return [Number(found[1]), Number(found[2]), Number(found[3])];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PUTIH: [number, number, number] = [255, 255, 255];

describe("palet pemasaran", () => {
  it("label tombol utama gelap di atas amber, bukan putih", () => {
    expect(contrast(token("on-action"), token("action"))).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * Ambangnya 3:1, bukan 4.5:1, dan itu keputusan yang menentukan cakupan
   * tokennya: #C67F0A memberi 3,26:1 di atas putih, jadi ia sah untuk teks
   * BESAR (mulai 24px, atau 18,66px tebal) dan tidak sah untuk teks isi.
   *
   * Karena itu `--emphasis` di permukaan pemasaran hanya boleh dipakai pada
   * numeral besar dan harga — bukan pada paragraf, caption, atau label 11px.
   * Kalau suatu hari ia dibutuhkan untuk teks isi, yang harus berubah adalah
   * nilainya (digelapkan sampai lolos 4,5:1), bukan ambang di tes ini.
   */
  it("teks penekanan lolos ambang teks besar di atas putih", () => {
    expect(contrast(token("emphasis"), PUTIH)).toBeGreaterThanOrEqual(3);
  });

  it("chip kata kunci: teks mint di atas tint mint", () => {
    expect(contrast(token("result-ink"), token("result-bg"))).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * Membuktikan sebab --emphasis ada.
   *
   * Kalau suatu hari nilai ini lolos 3:1, itu berarti amber-nya sudah diganti
   * jadi warna lain — dan seluruh aturan "amber hanya untuk aksi dan angka"
   * perlu dibaca ulang, bukan diteruskan diam-diam.
   */
  it("membuktikan amber mentah TIDAK boleh jadi teks di atas putih", () => {
    expect(contrast(token("action"), PUTIH)).toBeLessThan(3);
  });
});
