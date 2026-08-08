import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/unduhan-settings", () => ({ getUnduhanSettings: vi.fn() }));

import { GET } from "@/app/api/extension/latest/route";
import { getUnduhanSettings } from "@/lib/unduhan-settings";
import { UNDUHAN_KOSONG } from "@/lib/unduhan";

const ZIP =
  "https://github.com/alfianzack/nerona-hub-releases/releases/download/ext-v1.1.2/nerona-metadata-1.1.2.zip";

// IP yang berbeda per tes: rate limiter-nya in-memory dan berbagi state antar
// tes di berkas ini, jadi tanpa ini tes ketujuh gagal karena ulah tes pertama.
let nomor = 0;
function req() {
  nomor += 1;
  return new Request("http://test/api/extension/latest", {
    headers: { "x-forwarded-for": `10.0.0.${nomor}` },
  });
}

function settings(extensionVersion: string, extensionUrl: string) {
  (getUnduhanSettings as any).mockResolvedValue({
    ...UNDUHAN_KOSONG,
    extensionVersion,
    extensionUrl,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/extension/latest", () => {
  it("mengembalikan versi dan URL apa adanya", async () => {
    settings("1.1.2", ZIP);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, versi: "1.1.2", url: ZIP });
  });

  it("menyetel Cache-Control supaya endpoint tanpa auth tidak membebani DB", async () => {
    settings("1.1.2", ZIP);
    const res = await GET(req());
    expect(res.headers.get("Cache-Control")).toMatch(/max-age=\d+/);
  });

  it("503 selama belum ada rilis sama sekali", async () => {
    // Skrip harus bisa membedakan "belum ada rilis" dari "server rusak", dan
    // keduanya BUKAN "ini URL-nya, silakan unduh".
    settings("", "");
    const res = await GET(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toBeTruthy();
  });

  it("503 kalau versinya ada tapi URL-nya belum", async () => {
    settings("1.1.2", "");
    expect((await GET(req())).status).toBe(503);
  });

  it("503 kalau URL-nya ada tapi versinya belum", async () => {
    // Tanpa versi, skrip tidak bisa memutuskan perlu memperbarui atau tidak —
    // dan mengunduh tanpa alasan itu lebih buruk daripada tidak berbuat apa-apa.
    settings("", ZIP);
    expect((await GET(req())).status).toBe(503);
  });

  it("503 untuk URL yang tidak boleh diunduh", async () => {
    // Nilainya diketik admin. `tautanAman` adalah penjaganya, dan di sini titik
    // render-nya: yang keluar dari rute ini langsung dipakai skrip untuk mengunduh.
    for (const jahat of ["http://x/y.zip", "javascript:alert(1)", "https://x/dua kata.zip"]) {
      settings("1.1.2", jahat);
      expect((await GET(req())).status).toBe(503);
    }
  });

  it("429 kalau satu IP memanggilnya terlalu sering", async () => {
    settings("1.1.2", ZIP);
    const sama = () =>
      new Request("http://test/api/extension/latest", {
        headers: { "x-forwarded-for": "203.0.113.9" },
      });
    let terakhir = await GET(sama());
    for (let i = 0; i < 200 && terakhir.status !== 429; i += 1) {
      terakhir = await GET(sama());
    }
    expect(terakhir.status).toBe(429);
    expect(terakhir.headers.get("Retry-After")).toBeTruthy();
  });
});
