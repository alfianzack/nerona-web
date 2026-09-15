import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/image-generation", () => ({ generateImage: vi.fn() }));

import { POST } from "@/app/api/generate/image/route";
import { getServerSession } from "next-auth";
import { generateImage } from "@/lib/image-generation";

function req(body: unknown) {
  return new Request("http://localhost/api/generate/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
  (generateImage as any).mockResolvedValue({
    ok: true,
    id: "g1",
    url: "https://cdn.example/a.png",
    urls: ["https://cdn.example/a.png"],
    ids: ["g1"],
    points: 40,
    sisaPoin: 460,
  });
});

describe("POST /api/generate/image", () => {
  it("401 tanpa sesi, dan tidak menyentuh generator sama sekali", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(req({ prompt: "a", size: "1024x1024" }));
    expect(res.status).toBe(401);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("400 kalau prompt kosong", async () => {
    const res = await POST(req({ prompt: "   ", size: "1024x1024" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "prompt_kosong" });
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("jalur sukses mengembalikan url, poin, dan sisa saldo", async () => {
    const res = await POST(req({ prompt: "  kaktus datar  ", size: "1024x1024" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      id: "g1",
      url: "https://cdn.example/a.png",
      urls: ["https://cdn.example/a.png"],
      ids: ["g1"],
      points: 40,
      pointsBalance: 460,
    });
    // userId dari sesi, bukan dari badan permintaan, dan prompt sudah dipangkas.
    expect(generateImage).toHaveBeenCalledWith({
      userId: "u1",
      prompt: "kaktus datar",
      size: "1024x1024",
      jumlah: 1,
    });
  });

  it("jumlah diteruskan apa adanya, dan yang bukan angka jadi 1", async () => {
    await POST(req({ prompt: "a", size: "1024x1024", jumlah: 3 }));
    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ jumlah: 3 }));

    (generateImage as any).mockClear();
    await POST(req({ prompt: "a", size: "1024x1024", jumlah: "banyak" }));
    // Batasnya dijepit di lib; yang dijaga di sini cuma bentuknya, supaya NaN
    // tidak pernah sampai ke perhitungan poin.
    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ jumlah: 1 }));
  });

  /**
   * Status dibedakan karena tindakan tenant berbeda. 400 berarti "ubah
   * prompt-mu", 402 "isi ulang poin", 403 "paketmu tidak mencakup ini", 502 "di
   * seberang sedang gagal, coba lagi". Satu status untuk semuanya membuat layar
   * hanya bisa berkata "gagal".
   */
  it.each([
    ["blocked", 400],
    ["no_points", 402],
    ["plan", 403],
    ["no_model", 503],
    ["no_image", 502],
    ["upstream", 502],
  ])("kode %s dipetakan ke status %i", async (code, status) => {
    (generateImage as any).mockResolvedValue({ ok: false, code });
    const res = await POST(req({ prompt: "a", size: "1024x1024" }));
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ ok: false, error: code });
  });
});
