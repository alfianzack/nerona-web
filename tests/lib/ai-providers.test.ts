import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiProvider: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    aiModel: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import {
  AiProviderError,
  createProvider,
  deleteProvider,
  listProvidersForAdmin,
  resolveProviderCredentials,
  updateProvider,
} from "@/lib/ai-providers";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUMOPOD_API_KEY = "kunci-env";
  process.env.SUMOPOD_BASE_URL = "https://env.example/v1";
  (prisma.aiModel.count as any).mockResolvedValue(0);
  (prisma.aiProvider.findFirst as any).mockResolvedValue(null);
  (prisma.aiProvider.deleteMany as any).mockResolvedValue({ count: 1 });
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});

describe("resolveProviderCredentials", () => {
  it("jatuh ke env saat belum ada provider sama sekali — deploy hari ini tidak boleh mati", () => {
    expect(resolveProviderCredentials(null)).toEqual({
      apiKey: "kunci-env",
      baseUrl: "https://env.example/v1",
    });
  });

  it("jatuh ke env saat providernya ada tapi kuncinya kosong", () => {
    const creds = resolveProviderCredentials({ baseUrl: "https://a.example/v1", apiKey: "" });
    expect(creds.apiKey).toBe("kunci-env");
    expect(creds.baseUrl).toBe("https://a.example/v1");
  });

  it("memakai kunci dan alamat provider saat keduanya terisi", () => {
    expect(resolveProviderCredentials({ baseUrl: "https://a.example/v1", apiKey: "kunci-a" })).toEqual({
      apiKey: "kunci-a",
      baseUrl: "https://a.example/v1",
    });
  });

  it("memakai alamat bawaan saat env alamat tidak diset", () => {
    delete process.env.SUMOPOD_BASE_URL;
    expect(resolveProviderCredentials(null).baseUrl).toBe("https://ai.sumopod.com/v1");
  });
});

describe("listProvidersForAdmin", () => {
  it("tidak pernah mengembalikan kunci utuh, hanya bentuk tersamar", async () => {
    (prisma.aiProvider.findMany as any).mockResolvedValue([
      { id: "p1", label: "SumoPod", baseUrl: "https://a", apiKey: "sk-rahasia7f21", isDefault: true, sortOrder: 0 },
    ]);
    const list = await listProvidersForAdmin();
    expect(list[0].apiKeyMasked).toBe("****7f21");
    expect(list[0].apiKeySet).toBe(true);
    expect(JSON.stringify(list)).not.toContain("sk-rahasia7f21");
  });

  it("menandai provider tanpa kunci sebagai belum terisi", async () => {
    (prisma.aiProvider.findMany as any).mockResolvedValue([
      { id: "p1", label: "SumoPod", baseUrl: "https://a", apiKey: "", isDefault: true, sortOrder: 0 },
    ]);
    const list = await listProvidersForAdmin();
    expect(list[0].apiKeySet).toBe(false);
    expect(list[0].apiKeyMasked).toBe("");
  });
});

describe("createProvider", () => {
  it("menolak nama kosong", async () => {
    await expect(createProvider({ label: "  ", baseUrl: "https://a" })).rejects.toMatchObject({
      code: "label_required",
    });
  });

  it("menolak alamat kosong — provider tanpa alamat tidak bisa dipanggil", async () => {
    await expect(createProvider({ label: "SumoPod", baseUrl: " " })).rejects.toMatchObject({
      code: "base_url_required",
    });
  });

  it("menyimpan kunci kosong sebagai string kosong, bukan null", async () => {
    (prisma.aiProvider.create as any).mockResolvedValue({ id: "p1" });
    await createProvider({ label: "SumoPod", baseUrl: "https://a" });
    expect((prisma.aiProvider.create as any).mock.calls[0][0].data.apiKey).toBe("");
  });
});

describe("updateProvider", () => {
  it("kunci yang tidak dikirim berarti biarkan yang tersimpan", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue({ id: "p1" });
    (prisma.aiProvider.update as any).mockResolvedValue({ id: "p1" });
    await updateProvider("p1", { label: "SumoPod", baseUrl: "https://a" });
    expect((prisma.aiProvider.update as any).mock.calls[0][0].data).not.toHaveProperty("apiKey");
  });

  it("kunci yang dikirim menggantikan yang tersimpan", async () => {
    (prisma.aiProvider.findFirst as any).mockResolvedValue({ id: "p1" });
    (prisma.aiProvider.update as any).mockResolvedValue({ id: "p1" });
    await updateProvider("p1", { label: "SumoPod", baseUrl: "https://a", apiKey: "kunci-baru" });
    expect((prisma.aiProvider.update as any).mock.calls[0][0].data.apiKey).toBe("kunci-baru");
  });
});

describe("deleteProvider", () => {
  it("menolak menghapus provider yang masih dipakai model", async () => {
    (prisma.aiModel.count as any).mockResolvedValue(2);
    await expect(deleteProvider("p1")).rejects.toBeInstanceOf(AiProviderError);
    await expect(deleteProvider("p1")).rejects.toMatchObject({ code: "in_use" });
    expect(prisma.aiProvider.deleteMany).not.toHaveBeenCalled();
  });

  it("menghapus provider yang tidak dipakai siapa pun", async () => {
    await deleteProvider("p1");
    expect(prisma.aiProvider.deleteMany).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("menolak id yang tidak ada", async () => {
    (prisma.aiProvider.deleteMany as any).mockResolvedValue({ count: 0 });
    await expect(deleteProvider("hantu")).rejects.toMatchObject({ code: "not_found" });
  });
});
