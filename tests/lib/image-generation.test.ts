import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiModel: { findFirst: vi.fn() },
    aiProvider: { findFirst: vi.fn() },
    imageGeneration: { create: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));
vi.mock("@/lib/points", () => ({ spendPoints: vi.fn() }));

import { generateImage } from "@/lib/image-generation";
import { getAiSettings } from "@/lib/ai-settings";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { spendPoints } from "@/lib/points";
import { prisma } from "@/lib/prisma";

const MODEL = {
  id: "img1",
  label: "Generator",
  modelId: "flux-1",
  kind: "image",
  usdPerImage: 0.04,
  isDefault: true,
  active: true,
  planFree: false,
  planPro: true,
  planBusiness: true,
  provider: { id: "p1", label: "Gateway", baseUrl: "https://g.example/v1", apiKey: "kunci" },
};

function balasan(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  (getAiSettings as any).mockResolvedValue({
    model: "x",
    pricing: { inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 },
  });
  (getExtensionAccountState as any).mockResolvedValue({
    active: true,
    plan: "Business",
    pointsBalance: 500,
  });
  (prisma.aiModel.findFirst as any).mockResolvedValue(MODEL);
  (prisma.imageGeneration.create as any).mockImplementation(({ data }: any) => ({ id: "g1", ...data }));
  (spendPoints as any).mockResolvedValue(460);
  vi.stubGlobal("fetch", vi.fn(async () => balasan({ data: [{ url: "https://cdn.example/a.png" }] })));
});

describe("generateImage", () => {
  it("jalur sukses: memotong poin sesuai tarif per gambar dan menulis barisnya", async () => {
    const hasil = await generateImage({ userId: "u1", prompt: "kaktus datar", size: "1024x1024" });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.url).toBe("https://cdn.example/a.png");
    // 0,04 USD x 1000 = 40 poin. Angka ini yang dijanjikan tombolnya ke tenant
    // SEBELUM diklik, jadi ia harus keluar dari tarif barisnya, bukan dari
    // apa pun yang dikembalikan provider.
    expect(hasil.points).toBe(40);
    expect(spendPoints).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", cost: 40 })
    );
    expect((prisma.imageGeneration.create as any).mock.calls[0][0].data).toMatchObject({
      userId: "u1",
      prompt: "kaktus datar",
      size: "1024x1024",
      status: "ok",
      points: 40,
    });
  });

  /**
   * Pelajaran 2026-09-14, dan ia tidak boleh diulang di fitur baru: gpt-5
   * mengembalikan balasan kosong dan poinnya tetap terpotong. Ongkos ke provider
   * memang tetap kita bayar, tapi tenant tidak boleh membayar untuk nol hasil.
   */
  it("provider menjawab tanpa gambar: tidak memotong poin", async () => {
    (globalThis.fetch as any).mockResolvedValue(balasan({ data: [] }));

    const hasil = await generateImage({ userId: "u1", prompt: "apa saja", size: "1024x1024" });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe("no_image");
    expect(spendPoints).not.toHaveBeenCalled();
  });

  it("prompt ditolak penyaring provider: kode sendiri, bukan galat umum", async () => {
    (globalThis.fetch as any).mockResolvedValue(
      balasan({ error: { message: "Your request was rejected by the safety system" } }, 400)
    );

    const hasil = await generateImage({ userId: "u1", prompt: "terlarang", size: "1024x1024" });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    // "Prompt kamu ditolak" dan "servernya sedang mati" menuntut tindakan yang
    // berbeda dari tenant, jadi keduanya tidak boleh jadi satu pesan.
    expect(hasil.code).toBe("blocked");
    expect(spendPoints).not.toHaveBeenCalled();
  });

  it("provider mati: upstream, dan tetap tanpa potongan", async () => {
    (globalThis.fetch as any).mockResolvedValue(balasan({ error: { message: "bad gateway" } }, 502));

    const hasil = await generateImage({ userId: "u1", prompt: "apa saja", size: "1024x1024" });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe("upstream");
    expect(spendPoints).not.toHaveBeenCalled();
  });

  it("saldo tidak cukup: berhenti sebelum provider dipanggil", async () => {
    (getExtensionAccountState as any).mockResolvedValue({
      active: true,
      plan: "Business",
      pointsBalance: 3,
    });

    const hasil = await generateImage({ userId: "u1", prompt: "apa saja", size: "1024x1024" });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe("no_points");
    // Memanggil provider lebih dulu berarti Nerona membayar untuk gambar yang
    // tidak akan pernah bisa ditagihkan.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("paket tenant tidak mencakup model itu: ditolak tanpa memanggil provider", async () => {
    (getExtensionAccountState as any).mockResolvedValue({
      active: true,
      plan: "Free",
      pointsBalance: 500,
    });

    const hasil = await generateImage({ userId: "u1", prompt: "apa saja", size: "1024x1024" });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe("plan");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("belum ada model gambar di registri: dikatakan apa adanya", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(null);

    const hasil = await generateImage({ userId: "u1", prompt: "apa saja", size: "1024x1024" });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe("no_model");
  });

  it("hanya mencari baris kind image, bukan bawaan chat", async () => {
    await generateImage({ userId: "u1", prompt: "apa saja", size: "1024x1024" });
    expect((prisma.aiModel.findFirst as any).mock.calls[0][0]).toMatchObject({
      where: expect.objectContaining({ kind: "image", isDefault: true, active: true }),
    });
  });
});

/**
 * Jumlah gambar per permintaan. Bawaannya 1, dan tenant bisa menaikkannya.
 *
 * Yang membuat ini bukan sekadar mengalikan angka: provider boleh mengembalikan
 * LEBIH SEDIKIT gambar daripada yang diminta, dan saat itu terjadi tenant hanya
 * boleh ditagih untuk yang benar-benar jadi. Aturan yang sama dengan balasan
 * kosong, hanya sebagiannya.
 */
describe("generateImage, jumlah lebih dari satu", () => {
  function urlBanyak(n: number) {
    return balasan({ data: Array.from({ length: n }, (_, i) => ({ url: `https://cdn.example/${i}.png` })) });
  }

  it("menagih per gambar, dan menulis satu baris untuk tiap gambar", async () => {
    (globalThis.fetch as any).mockResolvedValue(urlBanyak(3));

    const hasil = await generateImage({ userId: "u1", prompt: "a", size: "1024x1024", jumlah: 3 });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.points).toBe(120);
    expect(hasil.urls).toHaveLength(3);
    // Satu id per gambar: klien memakainya untuk menempelkan thumbnail ke baris
    // yang benar, dan tanpa itu ia cuma bisa menebak.
    expect(hasil.ids).toHaveLength(3);
    expect(spendPoints).toHaveBeenCalledWith(expect.objectContaining({ cost: 120 }));
    expect((prisma.imageGeneration.create as any).mock.calls).toHaveLength(3);
  });

  it("provider mengembalikan lebih sedikit: yang ditagih hanya yang jadi", async () => {
    (globalThis.fetch as any).mockResolvedValue(urlBanyak(2));

    const hasil = await generateImage({ userId: "u1", prompt: "a", size: "1024x1024", jumlah: 4 });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    // Dua jadi, dua tidak. Menagih 160 untuk 2 gambar adalah menagih untuk
    // sesuatu yang tidak pernah ada.
    expect(hasil.points).toBe(80);
    expect(spendPoints).toHaveBeenCalledWith(expect.objectContaining({ cost: 80 }));
  });

  it("saldo diperiksa untuk SELURUH permintaan, bukan satu gambar", async () => {
    (getExtensionAccountState as any).mockResolvedValue({
      active: true, plan: "Business", pointsBalance: 100,
    });

    const hasil = await generateImage({ userId: "u1", prompt: "a", size: "1024x1024", jumlah: 3 });

    // 3 x 40 = 120, saldo 100. Memeriksa satu gambar saja akan meloloskan ini
    // lalu berakhir dengan saldo minus atau potongan yang gagal separuh jalan.
    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.code).toBe("no_points");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("jumlah dibatasi, dan yang di luar batas dijepit bukan ditolak", async () => {
    (globalThis.fetch as any).mockResolvedValue(urlBanyak(4));
    (getExtensionAccountState as any).mockResolvedValue({
      active: true, plan: "Business", pointsBalance: 9999,
    });

    await generateImage({ userId: "u1", prompt: "a", size: "1024x1024", jumlah: 99 });

    // Batas atas menjaga satu klik keliru tidak menghabiskan saldo sekaligus.
    expect((globalThis.fetch as any).mock.calls[0][1].body).toContain('"n":4');
  });

  it("tanpa jumlah, tetap satu gambar", async () => {
    await generateImage({ userId: "u1", prompt: "a", size: "1024x1024" });
    expect((globalThis.fetch as any).mock.calls[0][1].body).toContain('"n":1');
  });
});
