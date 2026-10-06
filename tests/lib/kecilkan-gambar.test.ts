import { describe, expect, it } from "vitest";
import { SISI_MAKS, ukuranTarget } from "@/components/prompt/kecilkan-gambar";

describe("ukuranTarget", () => {
  it("sisi terpanjang jadi 1280, rasio dipertahankan", () => {
    expect(ukuranTarget(4000, 3000)).toEqual({ lebar: SISI_MAKS, tinggi: 960 });
    expect(ukuranTarget(1000, 5000)).toEqual({ lebar: 256, tinggi: SISI_MAKS });
  });

  it("gambar kecil tidak diperbesar", () => {
    expect(ukuranTarget(800, 600)).toEqual({ lebar: 800, tinggi: 600 });
  });
});
