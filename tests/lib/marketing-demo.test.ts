import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { setting: { findUnique: vi.fn() } },
}));

import { demoVideoUrl } from "@/lib/marketing-demo";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NERONA_DEMO_VIDEO_URL;
  (prisma.setting.findUnique as any).mockResolvedValue(null);
});

describe("demoVideoUrl", () => {
  it("memakai nilai dari Setting kalau ada", async () => {
    (prisma.setting.findUnique as any).mockResolvedValue({ value: "https://cdn.example/demo.mp4" });
    expect(await demoVideoUrl()).toBe("https://cdn.example/demo.mp4");
  });

  it("jatuh ke env kalau baris Setting-nya kosong", async () => {
    (prisma.setting.findUnique as any).mockResolvedValue({ value: "   " });
    process.env.NERONA_DEMO_VIDEO_URL = "https://cdn.example/env.mp4";
    expect(await demoVideoUrl()).toBe("https://cdn.example/env.mp4");
  });

  /**
   * Yang menentukan: null, bukan string kosong.
   *
   * Band demo mengembalikan null saat tidak ada video, dan pita navy pekat
   * berisi pemutar video kosong lebih buruk daripada tidak ada pita sama
   * sekali — ia memberi tahu pengunjung bahwa ada bagian halaman yang belum
   * jadi. Sebab yang sama dituliskan panjang di ProofSection.
   */
  it("null kalau tidak ada di keduanya", async () => {
    expect(await demoVideoUrl()).toBeNull();
  });

  /**
   * Beranda tidak boleh jatuh karena satu pita hiasan. Kebijakan yang sama
   * dipakai marketing-points.ts: yang hilang kalimatnya, bukan halamannya.
   */
  it("null, bukan melempar, kalau kueri Setting gagal", async () => {
    (prisma.setting.findUnique as any).mockRejectedValue(new Error("db mati"));
    expect(await demoVideoUrl()).toBeNull();
  });
});
