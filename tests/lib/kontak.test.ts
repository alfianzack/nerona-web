import { describe, expect, it } from "vitest";

import { KONTAK, waLink, formatNomorWa } from "@/lib/kontak";

/**
 * Audit halaman jualan: "Tidak ada email, WhatsApp, atau info badan usaha di
 * mana pun. Untuk model pembayaran manual yang diverifikasi 'tim kami', ini
 * penghambat kepercayaan paling besar — orang diminta transfer ke pihak yang
 * tidak bisa dihubungi."
 *
 * Detailnya hidup di SATU berkas karena ia dipakai di footer, halaman syarat,
 * halaman privasi, dan halaman checkout sekaligus. Nomor yang diketik di empat
 * tempat akan berbeda di salah satunya begitu nomornya ganti — dan yang salah
 * justru yang dibaca orang saat ia sudah mentransfer uang.
 */
describe("formatNomorWa", () => {
  /**
   * Yang disimpan adalah bentuk E.164 (hanya angka, berawalan kode negara)
   * karena itu yang dituntut wa.me. Yang DIBACA manusia perlu spasi.
   */
  it("mengelompokkan nomor Indonesia supaya terbaca", () => {
    expect(formatNomorWa("628995005232")).toBe("+62 899 5005 232");
  });

  it("menerima bentuk yang sudah berawalan plus", () => {
    expect(formatNomorWa("+628995005232")).toBe("+62 899 5005 232");
  });
});

describe("waLink", () => {
  /**
   * wa.me menolak spasi, tanda plus, dan strip. Membangunnya dengan template
   * string di komponen adalah cara paling mudah mengirim orang ke tautan mati.
   */
  it("membuang segala yang bukan angka", () => {
    expect(waLink("+62 899 5005 232")).toBe("https://wa.me/628995005232");
  });

  it("menyisipkan pesan pembuka kalau diminta", () => {
    expect(waLink("628995005232", "Halo Nerona")).toBe(
      "https://wa.me/628995005232?text=Halo%20Nerona"
    );
  });
});

describe("KONTAK", () => {
  /** Tautan mati di footer lebih buruk daripada tidak ada tautan sama sekali. */
  it("nomor tersimpan sudah dalam bentuk yang wa.me terima", () => {
    expect(KONTAK.waNomor).toMatch(/^\d+$/);
    expect(waLink(KONTAK.waNomor)).toBe(`https://wa.me/${KONTAK.waNomor}`);
  });

  it("punya email yang bisa dipakai mailto", () => {
    expect(KONTAK.email).toContain("@");
  });
});
