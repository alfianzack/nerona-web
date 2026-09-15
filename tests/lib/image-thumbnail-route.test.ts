import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { imageGeneration: { findFirst: vi.fn(), update: vi.fn() } },
}));

import { PATCH, GET } from "@/app/api/generate/image/[id]/thumbnail/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

/** JPEG sah cuma dari angka ajaibnya: FF D8 FF. */
function jpeg(byte = 4000) {
  const b = Buffer.alloc(byte, 0x11);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  return b;
}

function req(body: Buffer, mime = "image/jpeg") {
  return new Request("http://localhost/api/generate/image/g1/thumbnail", {
    method: "PATCH",
    headers: { "content-type": mime },
    body: new Uint8Array(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
  (prisma.imageGeneration.findFirst as any).mockResolvedValue({ id: "g1", userId: "u1" });
  (prisma.imageGeneration.update as any).mockResolvedValue({});
});

describe("PATCH /api/generate/image/[id]/thumbnail", () => {
  it("menyimpan thumbnail milik sendiri", async () => {
    const res = await PATCH(req(jpeg()), { params: { id: "g1" } });
    expect(res.status).toBe(200);
    const data = (prisma.imageGeneration.update as any).mock.calls[0][0].data;
    expect(data.thumbMime).toBe("image/jpeg");
    expect(Buffer.isBuffer(data.thumbnail) || data.thumbnail instanceof Uint8Array).toBe(true);
  });

  /**
   * Barisnya dicari dengan userId dari SESI. Tanpa itu, siapa pun yang tahu
   * sebuah id bisa menempelkan gambar ke galeri orang lain.
   */
  it("baris milik orang lain: 404, dan tidak menulis apa pun", async () => {
    (prisma.imageGeneration.findFirst as any).mockResolvedValue(null);
    const res = await PATCH(req(jpeg()), { params: { id: "g1" } });
    expect(res.status).toBe(404);
    expect(prisma.imageGeneration.update).not.toHaveBeenCalled();
  });

  it("lebih besar dari 64 KB ditolak", async () => {
    const res = await PATCH(req(jpeg(70_000)), { params: { id: "g1" } });
    expect(res.status).toBe(413);
    expect(prisma.imageGeneration.update).not.toHaveBeenCalled();
  });

  /**
   * Content-Type dikirim klien, jadi ia janji bukan bukti. Yang diperiksa isi
   * berkasnya: tanpa ini, kolom bernama thumbnail bisa berisi apa saja, dan
   * galeri akan menyajikannya kembali ke browser sebagai gambar.
   */
  it("bukan gambar sungguhan ditolak meski mime-nya mengaku gambar", async () => {
    const res = await PATCH(req(Buffer.from("<html>bukan gambar</html>")), { params: { id: "g1" } });
    expect(res.status).toBe(415);
    expect(prisma.imageGeneration.update).not.toHaveBeenCalled();
  });

  it("tanpa sesi: 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await PATCH(req(jpeg()), { params: { id: "g1" } });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/generate/image/[id]/thumbnail", () => {
  it("menyajikan bytes milik sendiri dengan mime tersimpan", async () => {
    (prisma.imageGeneration.findFirst as any).mockResolvedValue({
      id: "g1",
      userId: "u1",
      thumbnail: jpeg(1000),
      thumbMime: "image/jpeg",
    });
    const res = await GET(new Request("http://localhost/x"), { params: { id: "g1" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    // Milik satu tenant, jadi tidak boleh nyangkut di cache bersama.
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("baris tanpa thumbnail: 404", async () => {
    (prisma.imageGeneration.findFirst as any).mockResolvedValue({ id: "g1", userId: "u1" });
    const res = await GET(new Request("http://localhost/x"), { params: { id: "g1" } });
    expect(res.status).toBe(404);
  });
});
