import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/unduhan-settings", () => ({ getUnduhanSettings: vi.fn() }));

import {
  HEADER_VERSI_EXTENSION,
  infoPembaruanExtension,
  tolakKalauBasi,
  versiExtensionDari,
} from "@/lib/extension-version";
import { getUnduhanSettings } from "@/lib/unduhan-settings";
import { UNDUHAN_KOSONG } from "@/lib/unduhan";

function req(versi?: string) {
  return new Request("http://test/api/extension/generate", {
    headers: versi ? { [HEADER_VERSI_EXTENSION]: versi } : {},
  });
}

function settings(extensionVersion: string, extensionMinVersion: string) {
  (getUnduhanSettings as any).mockResolvedValue({
    ...UNDUHAN_KOSONG,
    extensionVersion,
    extensionMinVersion,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_URL = "https://nerona-web.vercel.app";
});
afterEach(() => {
  delete process.env.NEXTAUTH_URL;
});

describe("versiExtensionDari", () => {
  it("membaca header, dan null kalau tidak ada atau kosong", () => {
    expect(versiExtensionDari(req("1.2.0"))).toBe("1.2.0");
    expect(versiExtensionDari(req("  1.2.0  "))).toBe("1.2.0");
    expect(versiExtensionDari(req("   "))).toBeNull();
    expect(versiExtensionDari(req())).toBeNull();
  });
});

describe("infoPembaruanExtension", () => {
  it("menunjuk ke halaman /unduh, bukan ke asetnya langsung", async () => {
    // Halaman itu yang memuat petunjuk pemasangannya; tautan langsung ke ZIP
    // meninggalkan pengguna dengan berkas dan tanpa tahu harus diapakan.
    settings("1.2.0", "1.1.0");
    expect(await infoPembaruanExtension()).toEqual({
      latest: "1.2.0",
      min: "1.1.0",
      url: "https://nerona-web.vercel.app/unduh",
    });
  });

  it("tidak pernah menghasilkan garis miring ganda", async () => {
    process.env.NEXTAUTH_URL = "https://nerona-web.vercel.app/";
    settings("1.2.0", "");
    expect((await infoPembaruanExtension()).url).toBe("https://nerona-web.vercel.app/unduh");
  });
});

describe("tolakKalauBasi", () => {
  it("meloloskan yang memenuhi batas", async () => {
    settings("1.2.0", "1.1.0");
    expect(await tolakKalauBasi(req("1.1.0"))).toBeNull();
    expect(await tolakKalauBasi(req("1.2.0"))).toBeNull();
  });

  it("menolak yang di bawah batas, dan menyertakan cara keluarnya", async () => {
    settings("1.2.0", "1.1.0");
    expect(await tolakKalauBasi(req("1.0.9"))).toEqual({
      latest: "1.2.0",
      min: "1.1.0",
      url: "https://nerona-web.vercel.app/unduh",
    });
  });

  it("menolak permintaan yang tidak menyebut versinya", async () => {
    // Salinan yang terbit sebelum header ini ada. Itu memang yang diblokir.
    settings("1.2.0", "1.1.0");
    expect(await tolakKalauBasi(req())).not.toBeNull();
  });

  it("meloloskan semua orang selama batasnya belum ditetapkan", async () => {
    settings("1.2.0", "");
    expect(await tolakKalauBasi(req("0.0.1"))).toBeNull();
    expect(await tolakKalauBasi(req())).toBeNull();
  });
});
