import { afterEach, describe, expect, it } from "vitest";
import { baseUrl } from "@/lib/base-url";

const asli = { ...process.env };

afterEach(() => {
  process.env = { ...asli };
});

function bersihkan() {
  delete process.env.NEXTAUTH_URL;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL;
}

describe("baseUrl", () => {
  it("memakai NEXTAUTH_URL kalau ada", () => {
    bersihkan();
    process.env.NEXTAUTH_URL = "https://nerona-web.vercel.app";
    expect(baseUrl()).toBe("https://nerona-web.vercel.app");
  });

  it("membuang garis miring di ujung", () => {
    // Nilainya digabung jadi `${baseUrl()}/hubungkan`, jadi satu garis miring
    // berlebih menghasilkan `//hubungkan`.
    bersihkan();
    process.env.NEXTAUTH_URL = "https://nerona-web.vercel.app/";
    expect(baseUrl()).toBe("https://nerona-web.vercel.app");
  });

  it("jatuh ke localhost hanya saat benar-benar lokal", () => {
    bersihkan();
    expect(baseUrl()).toBe("http://localhost:3000");
  });

  /**
   * Ini yang benar-benar terjadi di produksi: NEXTAUTH_URL tidak terpasang di
   * Vercel, dan /api/extension/pair/start membagikan
   * `http://localhost:3000/hubungkan?kode=…` ke SETIAP Nerona Hub yang mencoba
   * menyambung. Tidak ada satu pun galat — hanya browser yang membuka alamat
   * yang tidak akan pernah ada di mesin pengguna.
   */
  it("TIDAK PERNAH mengembalikan localhost saat berjalan di Vercel", () => {
    bersihkan();
    process.env.VERCEL = "1";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "nerona-web.vercel.app";
    expect(baseUrl()).toBe("https://nerona-web.vercel.app");
  });

  it("memakai host deployment kalau host produksi belum disuntik", () => {
    bersihkan();
    process.env.VERCEL = "1";
    process.env.VERCEL_URL = "nerona-web-abc123.vercel.app";
    expect(baseUrl()).toBe("https://nerona-web-abc123.vercel.app");
  });

  it("NEXTAUTH_URL menang atas host Vercel", () => {
    // Domain kustom hidup di NEXTAUTH_URL; host bawaan Vercel tidak boleh
    // menggantikannya.
    bersihkan();
    process.env.VERCEL = "1";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "nerona-web.vercel.app";
    process.env.NEXTAUTH_URL = "https://app.nerona.id";
    expect(baseUrl()).toBe("https://app.nerona.id");
  });

  it("nilai kosong atau hanya spasi diperlakukan seperti tidak diisi", () => {
    bersihkan();
    process.env.NEXTAUTH_URL = "   ";
    process.env.VERCEL = "1";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "nerona-web.vercel.app";
    expect(baseUrl()).toBe("https://nerona-web.vercel.app");
  });
});
