import { describe, expect, it } from "vitest";
import { BATAS_RIWAYAT_BANDING, cariDuplikat, jarakSidik } from "@/lib/extension/duplikat";

/**
 * Penjaga duplikat menuduh, dan tuduhan salah itu mahal: kontributor menahan
 * berkas yang sebenarnya boleh dikirim. Jadi yang dijaga tes ini bukan
 * "menemukan duplikat", melainkan "tidak menemukan yang bukan duplikat".
 *
 * Jarak Hamming di sini kembaran dari nerona_medata/guard/sidik.js. Tanpa
 * bundler keduanya tidak bisa jadi satu berkas, jadi dua berkas uji yang memaku
 * angka yang sama: scripts/guard-sidik.test.mjs dan berkas ini.
 */
const NOL = "0000000000000000";

function baris(imageHash: string | null, tambahan: Record<string, unknown> = {}) {
  return {
    id: "c1",
    title: "Business team meeting",
    marketplace: "adobe",
    createdAt: new Date("2026-07-14T10:00:00Z"),
    imageHash,
    ...tambahan,
  };
}

describe("jarakSidik", () => {
  it("sidik yang sama berjarak nol", () => {
    expect(jarakSidik(NOL, NOL)).toBe(0);
  });

  it("menghitung bit yang berbeda, bukan huruf yang berbeda", () => {
    expect(jarakSidik(NOL, "0000000000000001")).toBe(1);
    expect(jarakSidik(NOL, "000000000000000f")).toBe(4);
    expect(jarakSidik(NOL, "ffffffffffffffff")).toBe(64);
  });

  it("panjang yang beda tidak dipaksa dibandingkan", () => {
    expect(jarakSidik("0000", NOL)).toBeNull();
    expect(jarakSidik("", "")).toBeNull();
  });

  it("huruf di luar heks ditolak, bukan dibaca nol", () => {
    expect(jarakSidik("zzzzzzzzzzzzzzzz", NOL)).toBeNull();
  });
});

describe("cariDuplikat", () => {
  it("riwayat kosong berarti tidak ada duplikat", () => {
    expect(cariDuplikat({ sidik: NOL, riwayat: [], ambang: 10 })).toBeNull();
  });

  it("sidik yang tidak sah tidak pernah menuduh siapa pun", () => {
    expect(cariDuplikat({ sidik: "", riwayat: [baris(NOL)], ambang: 10 })).toBeNull();
    expect(cariDuplikat({ sidik: "xyz", riwayat: [baris(NOL)], ambang: 10 })).toBeNull();
  });

  it("kecocokan persis ditemukan dan jaraknya nol", () => {
    const hasil = cariDuplikat({ sidik: NOL, riwayat: [baris(NOL)], ambang: 10 });
    expect(hasil?.jarak).toBe(0);
    expect(hasil?.title).toBe("Business team meeting");
  });

  it("kemiripan di bawah ambang ditemukan", () => {
    const hasil = cariDuplikat({ sidik: NOL, riwayat: [baris("000000000000000f")], ambang: 10 });
    expect(hasil?.jarak).toBe(4);
  });

  it("kemiripan di atas ambang bukan duplikat", () => {
    expect(cariDuplikat({ sidik: NOL, riwayat: [baris("00000000000000ff")], ambang: 4 })).toBeNull();
  });

  it("ambang itu batas yang ikut, bukan batas yang lewat", () => {
    expect(cariDuplikat({ sidik: NOL, riwayat: [baris("000000000000000f")], ambang: 4 })?.jarak).toBe(4);
  });

  it("yang dipilih yang paling mirip, bukan yang pertama ditemui", () => {
    const hasil = cariDuplikat({
      sidik: NOL,
      riwayat: [
        baris("000000000000000f", { id: "jauh" }),
        baris("0000000000000001", { id: "dekat" }),
      ],
      ambang: 10,
    });
    expect(hasil?.id).toBe("dekat");
  });

  it("kalau sama miripnya, yang lebih baru yang disebut", () => {
    const hasil = cariDuplikat({
      sidik: NOL,
      riwayat: [
        baris(NOL, { id: "baru", createdAt: new Date("2026-09-01T00:00:00Z") }),
        baris(NOL, { id: "lama", createdAt: new Date("2026-01-01T00:00:00Z") }),
      ],
      ambang: 10,
    });
    expect(hasil?.id).toBe("baru");
  });

  it("baris lama tanpa sidik dilewati, bukan bikin galat", () => {
    expect(cariDuplikat({ sidik: NOL, riwayat: [baris(null)], ambang: 10 })).toBeNull();
  });

  it("baris dengan sidik rusak dilewati", () => {
    expect(cariDuplikat({ sidik: NOL, riwayat: [baris("0000")], ambang: 10 })).toBeNull();
  });

  it("batas riwayat yang dibandingkan disebut, bukan tak terbatas", () => {
    // Dua ribu perbandingan 64 bit itu murah; menarik seluruh riwayat
    // kontributor lama tidak.
    expect(BATAS_RIWAYAT_BANDING).toBe(2000);
  });
});
