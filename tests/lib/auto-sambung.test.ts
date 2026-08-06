import { describe, expect, it } from "vitest";
import {
  bolehSambungOtomatis,
  punyaTokenInstalasi,
  type KeadaanSambungOtomatis,
} from "@/lib/auto-sambung";

const INI = "a3f9c1d2";
const LAIN = "b7c2e0f1";

/** Semua syarat terpenuhi. Tiap tes merusak SATU saja, supaya jelas mana yang menahan. */
function keadaanSiap(): KeadaanSambungOtomatis {
  return {
    tokensDimuat: true,
    instalasi: INI,
    tokens: [],
    sibuk: false,
    sudahDicoba: false,
  };
}

describe("punyaTokenInstalasi", () => {
  it("menemukan baris milik instalasi ini", () => {
    expect(punyaTokenInstalasi([{ label: `Extension · Chrome · ${INI}` }], INI)).toBe(true);
  });

  it("tidak tertipu instalasi lain milik akun yang sama", () => {
    // Chrome di laptop dan Chrome di PC menghasilkan nama yang identik. Kalau
    // pencocokannya cuma pada nama, memasang di mesin kedua akan terlihat
    // seperti sudah tersambung — dan mesin itu tidak pernah dapat token.
    expect(punyaTokenInstalasi([{ label: `Extension · Chrome · ${LAIN}` }], INI)).toBe(false);
  });

  it("tidak tertipu label lama tanpa id", () => {
    expect(punyaTokenInstalasi([{ label: "Extension · Chrome" }], INI)).toBe(false);
    expect(punyaTokenInstalasi([{ label: "Token manual" }], INI)).toBe(false);
    expect(punyaTokenInstalasi([{ label: null }], INI)).toBe(false);
  });

  it("tanpa id instalasi tidak pernah cocok dengan apa pun", () => {
    // Bukan "belum punya" — melainkan tidak ada yang bisa dicocokkan. Kalau ini
    // mengembalikan true untuk label mana pun, build lama akan dianggap sudah
    // tersambung dan tidak pernah bisa menyambung sama sekali.
    const daftar = [{ label: `Extension · Chrome · ${INI}` }, { label: "Extension · Chrome" }];
    expect(punyaTokenInstalasi(daftar, null)).toBe(false);
    expect(punyaTokenInstalasi(daftar, "   ")).toBe(false);
  });
});

describe("bolehSambungOtomatis", () => {
  it("menembak saat semua syarat terpenuhi", () => {
    expect(bolehSambungOtomatis(keadaanSiap())).toBe(true);
  });

  it("menunggu daftar token benar-benar termuat", () => {
    // Daftar kosong di render pertama tidak bisa dibedakan dari akun yang
    // memang belum punya token. Menembak di situ mencetak kredensial permanen
    // atas dasar ketidaktahuan.
    expect(bolehSambungOtomatis({ ...keadaanSiap(), tokensDimuat: false })).toBe(false);
  });

  it("melewatkan build lama yang tidak melaporkan id instalasi", () => {
    // Tanpa id, `issueExtensionToken` tidak mencabut apa pun — jadi otomatis
    // akan mencetak satu token baru SETIAP kali halaman dibuka.
    expect(bolehSambungOtomatis({ ...keadaanSiap(), instalasi: null })).toBe(false);
    expect(bolehSambungOtomatis({ ...keadaanSiap(), instalasi: "  " })).toBe(false);
  });

  it("diam kalau akun ini sudah punya token dari instalasi ini", () => {
    expect(
      bolehSambungOtomatis({
        ...keadaanSiap(),
        tokens: [{ label: `Extension · Chrome · ${INI}` }],
      })
    ).toBe(false);
  });

  it("tetap menembak kalau token yang ada milik instalasi lain", () => {
    expect(
      bolehSambungOtomatis({
        ...keadaanSiap(),
        tokens: [{ label: `Extension · Chrome · ${LAIN}` }, { label: "Token manual" }],
      })
    ).toBe(true);
  });

  it("tidak menembak saat penyambungan lain sedang berjalan", () => {
    expect(bolehSambungOtomatis({ ...keadaanSiap(), sibuk: true })).toBe(false);
  });

  it("hanya sekali per muat halaman", () => {
    // Penjaga terpenting: `tokens` berubah beberapa kali dalam satu kunjungan
    // (muat awal, lalu muat ulang sesudah TERSAMBUNG). Tanpa ini, setiap
    // perubahan itu memicu pencetakan token baru.
    expect(bolehSambungOtomatis({ ...keadaanSiap(), sudahDicoba: true })).toBe(false);
  });
});
