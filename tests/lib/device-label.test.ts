import { describe, expect, it } from "vitest";
import {
  INSTALLATION_SEPARATOR,
  instalasiSah,
  labelPerangkat,
  pisahLabelPerangkat,
} from "@/lib/device-label";

describe("instalasiSah", () => {
  it("menerima heksadesimal huruf kecil 6–32 karakter", () => {
    expect(instalasiSah("a3f9c1d2")).toBe("a3f9c1d2");
    expect(instalasiSah("  a3f9c1d2  ")).toBe("a3f9c1d2");
  });

  it("menolak yang bisa melebarkan pencocokan saat mencabut", () => {
    // Yang paling berbahaya: string kosong dan spasi. Keduanya membuat
    // `endsWith(" · ")` cocok dengan SETIAP label berformat lama.
    expect(instalasiSah("")).toBeNull();
    expect(instalasiSah("   ")).toBeNull();
    expect(instalasiSah("A3F9C1D2")).toBeNull();
    expect(instalasiSah("a3f9")).toBeNull();
    expect(instalasiSah("a".repeat(33))).toBeNull();
    expect(instalasiSah("a3f9c1d2 OR 1=1")).toBeNull();
    expect(instalasiSah(null)).toBeNull();
    expect(instalasiSah(12345678)).toBeNull();
  });
});

describe("labelPerangkat", () => {
  it("menempelkan id di akhir", () => {
    expect(labelPerangkat("Extension · Chrome", "a3f9c1d2")).toBe(
      `Extension · Chrome${INSTALLATION_SEPARATOR}a3f9c1d2`
    );
  });

  it("tanpa id sah, labelnya tetap dibuat apa adanya", () => {
    // Build extension lama tidak mengirim id. Ia tetap boleh menyambung.
    expect(labelPerangkat("Extension · Chrome", null)).toBe("Extension · Chrome");
    expect(labelPerangkat("Extension · Chrome", "bukan-id")).toBe("Extension · Chrome");
  });
});

describe("pisahLabelPerangkat", () => {
  it("memisahkan nama dari id", () => {
    expect(pisahLabelPerangkat("Extension · Chrome · a3f9c1d2")).toEqual({
      nama: "Extension · Chrome",
      instalasi: "a3f9c1d2",
    });
  });

  it("label lama tanpa id dibiarkan utuh", () => {
    // "Chrome" bukan heksadesimal, jadi ia nama — bukan id yang salah bentuk.
    expect(pisahLabelPerangkat("Extension · Chrome")).toEqual({
      nama: "Extension · Chrome",
      instalasi: null,
    });
    expect(pisahLabelPerangkat("Token manual")).toEqual({
      nama: "Token manual",
      instalasi: null,
    });
  });

  it("label kosong tetap punya nama yang bisa ditampilkan", () => {
    expect(pisahLabelPerangkat(null)).toEqual({ nama: "Perangkat", instalasi: null });
    expect(pisahLabelPerangkat("  ")).toEqual({ nama: "Perangkat", instalasi: null });
  });
});
