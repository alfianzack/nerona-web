import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

const asli = { ...process.env };

function req(auth?: string) {
  return new Request("http://test/api/health", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_URL = "https://nerona-web.vercel.app";
});
afterEach(() => {
  process.env = { ...asli };
});

describe("GET /api/health", () => {
  it("menyebut alamat yang BENAR-BENAR dipakai server", async () => {
    // Inilah gunanya. Produksi pernah membagikan http://localhost:3000 ke
    // setiap Nerona Hub selama entah berapa lama, dan tidak ada satu pun
    // permukaan yang bisa ditanyai untuk mengetahuinya.
    const body = await (await GET(req())).json();
    expect(body.ok).toBe(true);
    expect(body.baseUrl).toBe("https://nerona-web.vercel.app");
  });

  it("tidak membocorkan apa pun tanpa rahasia", async () => {
    process.env.CRON_SECRET = "rahasia";
    process.env.RELEASE_SECRET = "nilai-yang-tidak-boleh-keluar";
    const body = await (await GET(req())).json();
    expect(body.env).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("nilai-yang-tidak-boleh-keluar");
  });

  it("membuka daftar env yang terpasang untuk pemanggil ber-rahasia", async () => {
    process.env.CRON_SECRET = "rahasia";
    process.env.RELEASE_SECRET = "ada";
    delete process.env.SUMOPOD_API_KEY;

    const body = await (await GET(req("Bearer rahasia"))).json();
    expect(body.env.RELEASE_SECRET).toBe(true);
    expect(body.env.SUMOPOD_API_KEY).toBe(false);
  });

  it("HANYA benar/salah, tidak pernah nilainya", async () => {
    // Yang bertanya sudah memegang CRON_SECRET, tapi itu bukan alasan
    // membagikan rahasia lain. Satu endpoint yang membocorkan seluruh env
    // mengubah satu rahasia yang bocor jadi semuanya bocor.
    process.env.CRON_SECRET = "rahasia";
    process.env.RELEASE_SECRET = "nilai-yang-tidak-boleh-keluar";
    const teks = JSON.stringify(await (await GET(req("Bearer rahasia"))).json());
    expect(teks).not.toContain("nilai-yang-tidak-boleh-keluar");
    expect(teks).not.toContain("rahasia");
  });

  it("rahasia salah diperlakukan seperti tanpa rahasia, bukan 401", async () => {
    // Probe publik tetap harus bisa membaca baseUrl walau rahasianya kedaluwarsa;
    // menolaknya membuat pemeriksaan paling penting ikut mati.
    process.env.CRON_SECRET = "rahasia";
    const res = await GET(req("Bearer salah"));
    expect(res.status).toBe(200);
    expect((await res.json()).env).toBeUndefined();
  });
});
