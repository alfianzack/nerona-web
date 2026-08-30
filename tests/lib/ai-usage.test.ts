import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiUsageLog: { create: vi.fn(), groupBy: vi.fn() },
  },
}));

import { MIN_SAMPLE, averageImageUsageByModel, recordAiUsage } from "@/lib/ai-usage";
import { prisma } from "@/lib/prisma";

function grup(over: Record<string, unknown> = {}) {
  return {
    aiModelId: "m1",
    _avg: { promptTokens: 2_800, completionTokens: 420 },
    _count: { _all: MIN_SAMPLE },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.aiUsageLog.groupBy as any).mockResolvedValue([]);
  (prisma.aiUsageLog.create as any).mockResolvedValue({ id: "u1" });
});

describe("averageImageUsageByModel", () => {
  it("memakai rata-rata nyata saat sampelnya cukup", async () => {
    (prisma.aiUsageLog.groupBy as any).mockResolvedValue([grup()]);
    const peta = await averageImageUsageByModel(["m1"]);
    expect(peta.get("m1")).toEqual({ promptTokens: 2_800, completionTokens: 420 });
  });

  it("membulatkan rata-rata ke bilangan bulat — token tidak pernah pecahan", async () => {
    (prisma.aiUsageLog.groupBy as any).mockResolvedValue([
      grup({ _avg: { promptTokens: 2_600.4, completionTokens: 399.6 } }),
    ]);
    expect(await averageImageUsageByModel(["m1"])).toEqual(
      new Map([["m1", { promptTokens: 2_600, completionTokens: 400 }]])
    );
  });

  /**
   * Ambang sampel adalah inti fitur ini. Rata-rata dari tiga panggilan lebih
   * buruk daripada konstanta terkalibrasi: ia bergoyang keras mengikuti satu
   * gambar yang kebetulan besar, dan angka yang bergoyang di layar harga
   * menghancurkan kepercayaan lebih cepat daripada angka yang tetap.
   */
  it("mengabaikan model yang sampelnya di bawah ambang", async () => {
    (prisma.aiUsageLog.groupBy as any).mockResolvedValue([
      grup({ _count: { _all: MIN_SAMPLE - 1 } }),
    ]);
    expect(await averageImageUsageByModel(["m1"]).then((m) => m.has("m1"))).toBe(false);
  });

  it("hanya merata-rata panggilan BER-GAMBAR, dalam jendela waktu", async () => {
    await averageImageUsageByModel(["m1", "m2"]);
    const where = (prisma.aiUsageLog.groupBy as any).mock.calls[0][0].where;
    expect(where.withImage).toBe(true);
    expect(where.aiModelId).toEqual({ in: ["m1", "m2"] });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("tidak menanyakan apa pun saat tidak ada model yang ditanya", async () => {
    expect(await averageImageUsageByModel([])).toEqual(new Map());
    expect(prisma.aiUsageLog.groupBy).not.toHaveBeenCalled();
  });

  it("mengabaikan kelompok tanpa model — panggilan model bawaan tidak mewakili baris mana pun", async () => {
    (prisma.aiUsageLog.groupBy as any).mockResolvedValue([grup({ aiModelId: null })]);
    expect((await averageImageUsageByModel(["m1"])).size).toBe(0);
  });
});

describe("recordAiUsage", () => {
  it("mencatat token, ongkos, dan apakah panggilannya membawa gambar", async () => {
    await recordAiUsage({
      userId: "u1",
      aiModelId: "m1",
      feature: "metadata",
      withImage: true,
      usage: { promptTokens: 2_700, completionTokens: 410 },
      points: 2,
    });
    expect((prisma.aiUsageLog.create as any).mock.calls[0][0].data).toMatchObject({
      userId: "u1",
      aiModelId: "m1",
      feature: "metadata",
      withImage: true,
      promptTokens: 2_700,
      completionTokens: 410,
      points: 2,
    });
  });

  /**
   * Poin sudah terpotong sebelum baris ini ditulis. Melempar di sini akan
   * menggagalkan permintaan yang SUDAH dibayar tenant — kehilangan catatan jauh
   * lebih murah daripada kehilangan hasil yang sudah dibayar.
   */
  it("tidak melempar saat penulisannya gagal", async () => {
    // Galatnya memang dicatat ke console — dibungkam di sini supaya keluaran
    // tes tetap bersih, bukan supaya kegagalannya tersembunyi.
    const senyap = vi.spyOn(console, "error").mockImplementation(() => {});
    (prisma.aiUsageLog.create as any).mockRejectedValue(new Error("db mati"));
    await expect(
      recordAiUsage({
        userId: "u1",
        aiModelId: null,
        feature: "metadata",
        withImage: true,
        usage: { promptTokens: 10, completionTokens: 5 },
        points: 1,
      })
    ).resolves.toBeUndefined();
    expect(senyap).toHaveBeenCalled();
    senyap.mockRestore();
  });

  it("tidak menulis apa pun saat provider tidak melaporkan token", async () => {
    await recordAiUsage({
      userId: "u1",
      aiModelId: "m1",
      feature: "metadata",
      withImage: true,
      usage: null,
      points: 1,
    });
    expect(prisma.aiUsageLog.create).not.toHaveBeenCalled();
  });
});
