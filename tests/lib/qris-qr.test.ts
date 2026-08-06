import { describe, expect, it } from "vitest";
import { tampakMuatanQris } from "@/lib/payments/sumopod";
import { qrisSvg } from "@/lib/payments/qr";

// Muatan QRIS statis yang bentuknya sah untuk keperluan uji: diawali 000201
// seperti setiap muatan EMVCo.
const MUATAN =
  "00020101021226670016COM.NOBUBANK.WWW01189360050300000898820214123456789012340303UMI51440014ID.CO.QRIS.WWW0215ID20232612345670303UMI5204581253033605802ID5910Nerona Uji6007Jakarta61051234062070703A0163045B7C";

describe("tampakMuatanQris", () => {
  it("mengenali muatan EMVCo", () => {
    expect(tampakMuatanQris(MUATAN)).toBe(true);
  });

  // Menggambar QR dari nomor rekening menghasilkan kode yang terpindai rapi
  // lalu GAGAL di aplikasi bank — kegagalan yang jauh lebih membingungkan
  // daripada tidak ada QR sama sekali. Karena itu bentuknya yang diperiksa,
  // bukan nama tipenya.
  it("menolak nomor rekening dan isi lain yang bukan QRIS", () => {
    expect(tampakMuatanQris("1308300301295957")).toBe(false);
    expect(tampakMuatanQris("")).toBe(false);
    expect(tampakMuatanQris(null)).toBe(false);
    expect(tampakMuatanQris(undefined)).toBe(false);
    // Diawali benar tapi terlalu pendek untuk muatan sungguhan.
    expect(tampakMuatanQris("000201")).toBe(false);
  });
});

describe("qrisSvg", () => {
  it("menggambar SVG yang memuat muatannya", async () => {
    const svg = await qrisSvg(MUATAN);
    expect(svg).toContain("<svg");
    expect(svg).toContain("path");
    // Latar putih wajib: kamera memindai kontras, dan QR transparan di atas
    // kartu bergradien gagal terbaca di sebagian perangkat.
    expect(svg?.toUpperCase()).toContain("#FFFFFF");
  });

  it("null alih-alih melempar untuk muatan yang tidak bisa digambar", async () => {
    // Jauh melewati kapasitas QR versi tertinggi.
    expect(await qrisSvg("x".repeat(10_000))).toBeNull();
  });
});
