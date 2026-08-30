import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    aiModel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    aiProvider: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
vi.mock("@/lib/ai-usage", () => ({ averageImageUsageByModel: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));

import {
  estimatePointsPerImage,
  listModelsForTenant,
  resolveAiForUser,
  setTenantModel,
  createModel,
  planTierFromState,
  AiModelError,
} from "@/lib/ai-models";
import { REFERENCE_IMAGE_USAGE, costForUsage } from "@/lib/agent/pricing";
import { getAiSettings } from "@/lib/ai-settings";
import { averageImageUsageByModel } from "@/lib/ai-usage";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { prisma } from "@/lib/prisma";

const GLOBAL = {
  model: "gemini-2.0-flash-lite",
  pricing: { inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 },
};

function row(over: Record<string, unknown> = {}) {
  return {
    id: "m1",
    label: "Claude Opus 5",
    modelId: "claude-opus-5",
    note: null,
    inPerMTok: 5,
    outPerMTok: 25,
    vision: true,
    planFree: true,
    planPro: true,
    planBusiness: true,
    isDefault: false,
    active: true,
    providerId: "p1",
    provider: { id: "p1", label: "SumoPod", baseUrl: "https://a.example/v1", apiKey: "kunci-a" },
    sortOrder: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUMOPOD_API_KEY = "kunci-env";
  delete process.env.SUMOPOD_BASE_URL;
  (getAiSettings as any).mockResolvedValue(GLOBAL);
  (averageImageUsageByModel as any).mockResolvedValue(new Map());
  (getExtensionAccountState as any).mockResolvedValue({ active: true, plan: "Business" });
  (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: null, aiModel: null });
  (prisma.aiModel.findFirst as any).mockResolvedValue(null);
  (prisma.aiModel.findMany as any).mockResolvedValue([]);
  (prisma.aiProvider.findFirst as any).mockResolvedValue(null);
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});

describe("resolveAiForUser dengan registri kosong", () => {
  it("memakai model & tarif Koneksi AI, dan kunci dari provider bawaan", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue({
      id: "p0",
      baseUrl: "https://bawaan.example/v1",
      apiKey: "kunci-bawaan",
    });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("gemini-2.0-flash-lite");
    expect(resolved.apiKey).toBe("kunci-bawaan");
    expect(resolved.baseUrl).toBe("https://bawaan.example/v1");
    expect(resolved.pricing).toEqual(GLOBAL.pricing);
  });

  it("jatuh ke env saat belum ada provider bawaan sama sekali", async () => {
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.apiKey).toBe("kunci-env");
    expect(resolved.baseUrl).toBe("https://ai.sumopod.com/v1");
  });
});

describe("resolveAiForUser memakai provider baris yang dipilih", () => {
  it("memakai kunci dan alamat provider baris itu, bukan gateway global", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1", aiModel: row() });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.apiKey).toBe("kunci-a");
    expect(resolved.baseUrl).toBe("https://a.example/v1");
  });

  it("jatuh ke kunci env saat provider baris itu belum diisi kuncinya", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      aiModelId: "m1",
      aiModel: row({ provider: { id: "p1", baseUrl: "https://a.example/v1", apiKey: "" } }),
    });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.apiKey).toBe("kunci-env");
    expect(resolved.baseUrl).toBe("https://a.example/v1");
  });
});

describe("createModel", () => {
  it("menolak baris tanpa provider — model tanpa gateway tidak bisa dipanggil", async () => {
    await expect(
      createModel({
        label: "X",
        modelId: "x",
        inPerMTok: 1,
        outPerMTok: 1,
        vision: true,
        planFree: true,
        planPro: true,
        planBusiness: true,
        active: true,
        providerId: "  ",
      })
    ).rejects.toMatchObject({ code: "provider_required" });
  });

  it("menolak providerId yang tidak ada", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue(null);
    await expect(
      createModel({
        label: "X",
        modelId: "x",
        inPerMTok: 1,
        outPerMTok: 1,
        vision: true,
        planFree: true,
        planPro: true,
        planBusiness: true,
        active: true,
        providerId: "hantu",
      })
    ).rejects.toMatchObject({ code: "provider_not_found" });
  });
});

describe("resolveAiForUser with a registry", () => {
  it("uses the row the tenant picked, with that row's rates", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1", aiModel: row() });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("claude-opus-5");
    expect(resolved.pricing.inPerMTok).toBe(5);
    expect(resolved.pricing.outPerMTok).toBe(25);
  });

  it("keeps points-per-USD global — it is the owner's margin, not a model property", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1", aiModel: row() });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.pricing.pointsPerUsd).toBe(1_000);
  });

  it("falls back to the default row when the tenant has not chosen", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(
      row({ id: "m2", label: "Flash", modelId: "gemini-flash", inPerMTok: 0.25, outPerMTok: 1.5, isDefault: true })
    );
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("gemini-flash");
    expect(resolved.pricing.inPerMTok).toBe(0.25);
  });

  it("falls back to the DEFAULT row — never the cheapest — when the pick is deactivated", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      aiModelId: "m1",
      aiModel: row({ active: false }),
    });
    (prisma.aiModel.findFirst as any).mockResolvedValue(
      row({ id: "m2", modelId: "gemini-flash", inPerMTok: 2, outPerMTok: 8, isDefault: true })
    );
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("gemini-flash");
    expect(resolved.pricing.inPerMTok).toBe(2);
  });

});

describe("listModelsForTenant", () => {
  it("asks only for active models that can see", async () => {
    await listModelsForTenant({ tier: "business" });
    const where = (prisma.aiModel.findMany as any).mock.calls[0][0].where;
    expect(where.active).toBe(true);
    expect(where.vision).toBe(true);
  });

  it.each([
    ["free", "planFree"],
    ["pro", "planPro"],
    ["business", "planBusiness"],
  ] as const)("menyaring daftar dengan kolom paket %s", async (tier, kolom) => {
    await listModelsForTenant({ tier });
    const where = (prisma.aiModel.findMany as any).mock.calls[0][0].where;
    expect(where[kolom]).toBe(true);
  });

  it("never leaks a row's api key", async () => {
    (prisma.aiModel.findMany as any).mockResolvedValue([row({ apiKey: "row-key" })]);
    const rows = await listModelsForTenant({ tier: "business" });
    expect(JSON.stringify(rows)).not.toContain("row-key");
  });
});

describe("setTenantModel", () => {
  it("stores the choice", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row());
    await setTenantModel("user-1", "m1", { tier: "business" });
    expect((prisma.user.update as any).mock.calls[0][0]).toEqual({
      where: { id: "user-1" },
      data: { aiModelId: "m1" },
    });
  });

  it("clears the choice back to the owner default", async () => {
    await setTenantModel("user-1", null, { tier: "business" });
    expect((prisma.user.update as any).mock.calls[0][0].data).toEqual({ aiModelId: null });
  });

  it("menolak model yang tidak untuk paket itu, bukan sekadar menyembunyikannya", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ planFree: false }));
    await expect(setTenantModel("user-1", "m1", { tier: "free" })).rejects.toMatchObject({
      code: "plan_not_allowed",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses a model without vision — four of five features send an image", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ vision: false }));
    await expect(setTenantModel("user-1", "m1", { tier: "business" })).rejects.toBeInstanceOf(
      AiModelError
    );
  });

  it("refuses an inactive model", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ active: false }));
    await expect(setTenantModel("user-1", "m1", { tier: "business" })).rejects.toBeInstanceOf(
      AiModelError
    );
  });

  it("refuses a model that does not exist", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(null);
    await expect(setTenantModel("user-1", "nope", { tier: "business" })).rejects.toBeInstanceOf(
      AiModelError
    );
  });
});

describe("estimatePointsPerImage", () => {
  it("uses the same function that actually charges, not a second formula", () => {
    const pricing = { inPerMTok: 5, outPerMTok: 25, pointsPerUsd: 1_000 };
    const estimate = estimatePointsPerImage(pricing);
    // Memakai konstanta yang sama, bukan menyalin angkanya: tes yang menyalin
    // profil acuan berhenti menjaga apa pun begitu profilnya berubah — ia hanya
    // ikut berubah. Yang dijaga di sini adalah "fungsi penagih yang sama".
    expect(estimate).toBe(costForUsage({ usage: REFERENCE_IMAGE_USAGE, pricing }));
  });

  /**
   * Jangkar kalibrasi, dan satu-satunya tes di berkas ini yang dibandingkan
   * dengan UANG SUNGGUHAN, bukan dengan rumusnya sendiri.
   *
   * Produksi mencatat 862 pemotongan sebesar tepat 2 poin (29 Jul .. 28 Agu),
   * semuanya dibuat dengan tarif bawaan 0,25 / 1,5 / 1000. Profil acuan yang
   * jujur harus mereproduksi angka itu. Profil pertama (1.200/150) memberi 1,
   * separuh kenyataan — dan tidak ada satu tes pun yang menangkapnya karena
   * semua tes lain membandingkan estimasi dengan rumus yang sama.
   */
  it("mereproduksi tagihan nyata: tarif bawaan memotong 2 poin per gambar", () => {
    expect(estimatePointsPerImage({ inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 })).toBe(2);
  });

  it("puts an Opus-class model an order of magnitude above a flash-class one", () => {
    const cheap = estimatePointsPerImage({ inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 });
    const dear = estimatePointsPerImage({ inPerMTok: 5, outPerMTok: 25, pointsPerUsd: 1_000 });
    expect(cheap).toBe(2);
    expect(dear).toBe(23);
  });
});

describe("estimasi tenant memakai pemakaian nyata begitu datanya cukup", () => {
  const baris = () => row({ id: "m1", inPerMTok: 0.25, outPerMTok: 1.5 });

  it("memakai konstanta terkalibrasi selama model itu belum punya cukup data", async () => {
    (prisma.aiModel.findMany as any).mockResolvedValue([baris()]);
    const daftar = await listModelsForTenant({ tier: "business" });
    expect(daftar[0].estimatedPoints).toBe(
      costForUsage({ usage: REFERENCE_IMAGE_USAGE, pricing: { inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 } })
    );
  });

  /**
   * Inti langkah ini: begitu ada pemakaian sungguhan, angka di layar berhenti
   * bersandar pada konstanta yang pernah meleset separuh.
   */
  it("memakai rata-rata nyata model itu saat datanya sudah cukup", async () => {
    (prisma.aiModel.findMany as any).mockResolvedValue([baris()]);
    (averageImageUsageByModel as any).mockResolvedValue(
      new Map([["m1", { promptTokens: 6_000, completionTokens: 1_000 }]])
    );
    const daftar = await listModelsForTenant({ tier: "business" });
    expect(daftar[0].estimatedPoints).toBe(
      costForUsage({
        usage: { promptTokens: 6_000, completionTokens: 1_000 },
        pricing: { inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 },
      })
    );
  });

  it("hanya menanyakan model yang benar-benar ditampilkan", async () => {
    (prisma.aiModel.findMany as any).mockResolvedValue([baris()]);
    await listModelsForTenant({ tier: "business" });
    expect(averageImageUsageByModel).toHaveBeenCalledWith(["m1"]);
  });
});

describe("planTierFromState", () => {
  it.each([
    [{ active: false, plan: "Business" }, "free"],
    [{ active: true, plan: null }, "free"],
    [{ active: true, plan: "Free" }, "free"],
    [{ active: true, plan: "Pro" }, "pro"],
    [{ active: true, plan: "business" }, "business"],
  ] as const)("memetakan %o ke %s", (state, tier) => {
    expect(planTierFromState(state)).toBe(tier);
  });

  /**
   * Kolom bernama paket berarti paket keempat menuntut migrasi. Sampai itu
   * terjadi, paket berbayar yang tidak dikenal diperlakukan sebagai Pro — bukan
   * Free, karena menurunkan pelanggan yang membayar ke tingkat gratis adalah
   * kegagalan yang jauh lebih terasa daripada memberinya satu model ekstra.
   */
  it("memperlakukan paket berbayar yang belum punya kolom sebagai Pro", () => {
    expect(planTierFromState({ active: true, plan: "Enterprise" })).toBe("pro");
  });
});

describe("resolveAiForUser menghormati paket yang BERLAKU SEKARANG", () => {
  /**
   * Celah lama: pemeriksaan paket hanya berjalan saat tenant melihat daftar dan
   * saat memilih. `aiModelId` yang sudah tersimpan tidak pernah diperiksa lagi,
   * jadi tenant yang sempat memilih model mahal lalu paketnya habis tetap
   * memakainya — dan tetap ditagihkan dengan tarif model itu.
   */
  it("jatuh ke baris bawaan saat paket tenant tidak lagi mengizinkan pilihannya", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: false, plan: "Business" });
    (prisma.user.findUnique as any).mockResolvedValue({
      aiModelId: "m1",
      aiModel: row({ id: "m1", planFree: false, modelId: "mahal", inPerMTok: 5, outPerMTok: 25 }),
    });
    (prisma.aiModel.findFirst as any).mockResolvedValue(
      row({ id: "m0", modelId: "murah", isDefault: true, inPerMTok: 0.25, outPerMTok: 1.5 })
    );
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("murah");
    expect(resolved.pricing.inPerMTok).toBe(0.25);
  });

  it("tetap memakai pilihan tenant selama paketnya masih mengizinkan", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      aiModelId: "m1",
      aiModel: row({ id: "m1", modelId: "mahal", planFree: false }),
    });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("mahal");
  });
});
