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
  tenantModelScreen,
  resolveAiForUser,
  setTenantModel,
  createModel,
  planTierFromState,
  setDefaultModel,
  updateModel,
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

/** Janji yang baru selesai saat kita menyuruhnya, untuk memeriksa urutan query. */
function tertunda<T>() {
  let selesai!: (nilai: T) => void;
  return { janji: new Promise<T>((r) => (selesai = r)), selesai: (n: T) => selesai(n) };
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

  /// Tanpa baris registri tidak ada label yang bisa diambil, dan mengarang satu
  /// dari id model hanya memindahkan id mentah ke tempat yang mengaku label.
  it("tidak mengarang label saat model datang dari Koneksi AI", async () => {
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.label).toBeNull();
  });
});

describe("resolveAiForUser memakai provider baris yang dipilih", () => {
  it("memakai kunci dan alamat provider baris itu, bukan gateway global", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1", aiModel: row() });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.apiKey).toBe("kunci-a");
    expect(resolved.baseUrl).toBe("https://a.example/v1");
  });

  /// Nama yang dibaca manusia hanya ada di baris registri. Tanpa dibawa keluar
  /// dari sini, satu-satunya yang bisa ditampilkan extension adalah id mentah.
  it("membawa label baris itu, bukan cuma id modelnya", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1", aiModel: row() });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.label).toBe("Claude Opus 5");
    expect(resolved.modelId).toBe("claude-opus-5");
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
    ["free", ["bebas"]],
    ["pro", ["bebas", "berbayar"]],
    ["business", ["bebas", "berbayar", "teratas"]],
  ] as const)("paket %s hanya melihat model yang memang haknya", async (tier, terlihat) => {
    (prisma.aiModel.findMany as any).mockResolvedValue([
      row({ id: "bebas", planFree: true, planPro: true, planBusiness: true }),
      row({ id: "berbayar", planFree: false, planPro: true, planBusiness: true }),
      row({ id: "teratas", planFree: false, planPro: false, planBusiness: true }),
    ]);
    const daftar = await listModelsForTenant({ tier });
    expect(daftar.map((m) => m.id)).toEqual([...terlihat]);
  });

  /**
   * Inti perbaikan lambatnya halaman Model AI. Ketiga query ini tidak saling
   * membutuhkan, jadi menunggunya satu per satu membayar tiga kali perjalanan
   * ke Tokyo untuk pekerjaan yang muat dalam satu perjalanan.
   */
  it("menembakkan ketiga query sekaligus, bukan berurutan", async () => {
    const setelan = tertunda<typeof GLOBAL>();
    (getAiSettings as any).mockReturnValue(setelan.janji);

    const jalan = listModelsForTenant({ tier: "business" });
    expect(prisma.aiModel.findMany).toHaveBeenCalled();
    expect(averageImageUsageByModel).toHaveBeenCalled();

    setelan.selesai(GLOBAL);
    await jalan;
  });

  it("never leaks a row's api key", async () => {
    (prisma.aiModel.findMany as any).mockResolvedValue([row({ apiKey: "row-key" })]);
    const rows = await listModelsForTenant({ tier: "business" });
    expect(JSON.stringify(rows)).not.toContain("row-key");
  });
});

describe("tenantModelScreen", () => {
  beforeEach(() => {
    (prisma.aiModel.findMany as any).mockResolvedValue([row()]);
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1" });
  });

  it("mengembalikan daftar, pilihan tersimpan, dan tingkat paket sekaligus", async () => {
    const layar = await tenantModelScreen("user-1");
    expect(layar.models.map((m) => m.id)).toEqual(["m1"]);
    expect(layar.selectedId).toBe("m1");
    expect(layar.tier).toBe("business");
  });

  it("belum pernah memilih berarti selectedId null, bukan galat", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: null });
    expect((await tenantModelScreen("user-1")).selectedId).toBeNull();
  });

  // Pemetaan paket ini dulu dijaga di rute GET /api/model. Rutenya hilang,
  // penjagaannya tidak boleh ikut hilang.
  it.each([
    ["Free", true, "free"],
    ["Pro", true, "pro"],
    ["Business", true, "business"],
    // Lisensi kedaluwarsa turun ke free, betapa pun mahal paketnya.
    ["Business", false, "free"],
  ] as const)("paket %s (aktif: %s) jadi tingkat %s", async (plan, active, tier) => {
    (getExtensionAccountState as any).mockResolvedValue({ plan, active });
    expect((await tenantModelScreen("user-1")).tier).toBe(tier);
  });

  it("menembakkan semua query sekaligus, tidak menunggu tingkat paketnya dulu", async () => {
    const keadaan = tertunda<{ plan: string; active: boolean }>();
    (getExtensionAccountState as any).mockReturnValue(keadaan.janji);

    const jalan = tenantModelScreen("user-1");
    expect(prisma.aiModel.findMany).toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalled();
    expect(getAiSettings).toHaveBeenCalled();

    keadaan.selesai({ plan: "Business", active: true });
    await jalan;
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

  /**
   * Rata-rata diminta untuk semua model, bukan hanya yang ditampilkan: idnya
   * belum ada saat query ini berangkat. Yang harus dijaga adalah tiap baris
   * tetap memakai rata-ratanya sendiri, bukan milik tetangganya.
   */
  it("tiap baris memakai rata-ratanya sendiri, bukan milik baris lain", async () => {
    (prisma.aiModel.findMany as any).mockResolvedValue([baris()]);
    (averageImageUsageByModel as any).mockResolvedValue(
      new Map([["m-lain", { promptTokens: 60_000, completionTokens: 10_000 }]])
    );
    const daftar = await listModelsForTenant({ tier: "business" });
    expect(daftar[0].estimatedPoints).toBe(
      costForUsage({ usage: REFERENCE_IMAGE_USAGE, pricing: { inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 } })
    );
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

/**
 * Katalog model sekarang memuat dua jenis pekerjaan: "chat" untuk metadata dan
 * kawan-kawannya, "image" untuk generator gambar. Keduanya tinggal di satu tabel
 * supaya panel provider dan gerbang paket tidak perlu digandakan.
 *
 * Harganya yang tidak sebanding: chat ditagih per token, image per gambar. Satu
 * baris image yang bocor ke jalur chat berarti tarif per gambar dipakai sebagai
 * tarif per juta token, dan tagihannya meleset ribuan kali lipat tanpa satu pun
 * galat muncul. Empat uji di bawah menjaga pemisahan itu di tiap pintu.
 */
describe("pemisahan jenis model, chat lawan image", () => {
  it("resolveAiForUser tidak pernah mengambil baris image sebagai bawaan chat", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ kind: "chat", isDefault: true }));
    await resolveAiForUser("u1");
    expect((prisma.aiModel.findFirst as any).mock.calls[0][0]).toMatchObject({
      where: expect.objectContaining({ kind: "chat" }),
    });
  });

  it("listModelsForTenant tidak menawarkan model gambar untuk metadata", async () => {
    await listModelsForTenant({ tier: "business" } as any);
    expect((prisma.aiModel.findMany as any).mock.calls[0][0]).toMatchObject({
      where: expect.objectContaining({ kind: "chat" }),
    });
  });

  it("setDefaultModel hanya membersihkan bawaan di jenis yang sama", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ id: "img1", kind: "image" }));
    await setDefaultModel("img1");
    // Menjadikan model gambar sebagai bawaan tidak boleh mencabut bawaan chat:
    // seluruh jalur metadata akan jatuh ke tarif Koneksi AI tanpa peringatan.
    expect((prisma.aiModel.updateMany as any).mock.calls[0][0]).toMatchObject({
      where: { kind: "image" },
    });
  });

  it("angka poin per gambar di halaman publik dihitung dari model chat", async () => {
    // marketing-points memakai baris bawaan untuk menyebut ongkos metadata.
    // Baris image yang terpilih di sana akan menampilkan harga generator gambar
    // sebagai harga metadata.
    const { defaultModelPointsPerImage } = await import("@/lib/marketing-points");
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ kind: "chat", isDefault: true }));
    await defaultModelPointsPerImage();
    const panggilan = (prisma.aiModel.findFirst as any).mock.calls.at(-1)[0];
    expect(panggilan).toMatchObject({ where: expect.objectContaining({ kind: "chat" }) });
  });
});

/**
 * Baris model gambar dibuat lewat panel yang sama dengan model chat, karena
 * gerbang paket, provider, dan tombol aktifnya memang sama. Yang berbeda cuma
 * cara menagihnya, dan justru di situ letak bahayanya: baris image tanpa
 * usdPerImage akan lolos ke produksi dan baru ketahuan saat tenant pertama
 * menekan Buat gambar.
 */
describe("membuat baris model gambar", () => {
  const dasar = {
    label: "Generator",
    modelId: "flux-1",
    inPerMTok: 0,
    outPerMTok: 0,
    vision: false,
    planFree: false,
    planPro: true,
    planBusiness: true,
    active: true,
    providerId: "p1",
  };

  beforeEach(() => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue({ id: "p1" });
    (prisma.aiModel.create as any).mockImplementation(({ data }: any) => ({ id: "baru", ...data }));
    (prisma.aiModel.update as any).mockImplementation(({ data }: any) => ({ id: "m1", ...data }));
  });

  it("menyimpan kind dan tarif per gambar", async () => {
    await createModel({ ...dasar, kind: "image", usdPerImage: 0.04 } as never);
    expect((prisma.aiModel.create as any).mock.calls[0][0].data).toMatchObject({
      kind: "image",
      usdPerImage: 0.04,
    });
  });

  it("menolak baris image tanpa tarif per gambar", async () => {
    await expect(createModel({ ...dasar, kind: "image" } as never)).rejects.toThrow(AiModelError);
    await expect(
      createModel({ ...dasar, kind: "image", usdPerImage: 0 } as never)
    ).rejects.toThrow(AiModelError);
    expect(prisma.aiModel.create).not.toHaveBeenCalled();
  });

  it("baris chat tidak menyimpan tarif per gambar, meski dikirim", async () => {
    await createModel({ ...dasar, kind: "chat", usdPerImage: 0.04, inPerMTok: 1, outPerMTok: 2 } as never);
    // Tarif per gambar di baris chat adalah angka yang tidak pernah dipakai,
    // dan angka yang tidak pernah dipakai selalu jadi angka yang salah dibaca.
    expect((prisma.aiModel.create as any).mock.calls[0][0].data).toMatchObject({
      kind: "chat",
      usdPerImage: null,
    });
  });

  it("jenis yang tidak dikenal jatuh ke chat, bukan diteruskan apa adanya", async () => {
    await createModel({ ...dasar, kind: "video", usdPerImage: 1 } as never);
    expect((prisma.aiModel.create as any).mock.calls[0][0].data).toMatchObject({ kind: "chat" });
  });

  it("aturan yang sama berlaku saat menyunting", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ id: "m1" }));
    await expect(
      updateModel("m1", { ...dasar, kind: "image" } as never)
    ).rejects.toThrow(AiModelError);
  });
});
