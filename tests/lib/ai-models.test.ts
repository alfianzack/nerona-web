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
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));

import {
  estimatePointsPerImage,
  listModelsForTenant,
  resolveAiForUser,
  setTenantModel,
  AiModelError,
} from "@/lib/ai-models";
import { costForUsage } from "@/lib/agent/pricing";
import { getAiSettings } from "@/lib/ai-settings";
import { prisma } from "@/lib/prisma";

const GLOBAL = {
  model: "gemini-2.0-flash-lite",
  apiKey: "gateway-key",
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
    paidOnly: false,
    isDefault: false,
    active: true,
    baseUrl: null,
    apiKey: null,
    sortOrder: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getAiSettings as any).mockResolvedValue(GLOBAL);
  (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: null, aiModel: null });
  (prisma.aiModel.findFirst as any).mockResolvedValue(null);
  (prisma.aiModel.findMany as any).mockResolvedValue([]);
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});

describe("resolveAiForUser with an empty registry", () => {
  it("behaves exactly like today, so no bill changes before the owner fills the table", async () => {
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.modelId).toBe("gemini-2.0-flash-lite");
    expect(resolved.apiKey).toBe("gateway-key");
    expect(resolved.baseUrl).toBeUndefined();
    expect(resolved.pricing).toEqual(GLOBAL.pricing);
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

  it("uses the row's own gateway when it has one", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      aiModelId: "m1",
      aiModel: row({ baseUrl: "https://api.anthropic.example/v1", apiKey: "row-key" }),
    });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.baseUrl).toBe("https://api.anthropic.example/v1");
    expect(resolved.apiKey).toBe("row-key");
  });

  it("uses the global gateway when the row has none", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ aiModelId: "m1", aiModel: row() });
    const resolved = await resolveAiForUser("user-1");
    expect(resolved.baseUrl).toBeUndefined();
    expect(resolved.apiKey).toBe("gateway-key");
  });
});

describe("listModelsForTenant", () => {
  it("asks only for active models that can see", async () => {
    await listModelsForTenant({ paidPlan: true });
    const where = (prisma.aiModel.findMany as any).mock.calls[0][0].where;
    expect(where.active).toBe(true);
    expect(where.vision).toBe(true);
  });

  it("hides paid-only models from a free plan", async () => {
    await listModelsForTenant({ paidPlan: false });
    const where = (prisma.aiModel.findMany as any).mock.calls[0][0].where;
    expect(where.paidOnly).toBe(false);
  });

  it("shows paid-only models to a paid plan", async () => {
    await listModelsForTenant({ paidPlan: true });
    const where = (prisma.aiModel.findMany as any).mock.calls[0][0].where;
    expect(where.paidOnly).toBeUndefined();
  });

  it("never leaks a row's api key", async () => {
    (prisma.aiModel.findMany as any).mockResolvedValue([row({ apiKey: "row-key" })]);
    const rows = await listModelsForTenant({ paidPlan: true });
    expect(JSON.stringify(rows)).not.toContain("row-key");
  });
});

describe("setTenantModel", () => {
  it("stores the choice", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row());
    await setTenantModel("user-1", "m1", { paidPlan: true });
    expect((prisma.user.update as any).mock.calls[0][0]).toEqual({
      where: { id: "user-1" },
      data: { aiModelId: "m1" },
    });
  });

  it("clears the choice back to the owner default", async () => {
    await setTenantModel("user-1", null, { paidPlan: true });
    expect((prisma.user.update as any).mock.calls[0][0].data).toEqual({ aiModelId: null });
  });

  it("refuses a paid-only model on a free plan, not just hides it", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ paidOnly: true }));
    await expect(setTenantModel("user-1", "m1", { paidPlan: false })).rejects.toBeInstanceOf(
      AiModelError
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses a model without vision — four of five features send an image", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ vision: false }));
    await expect(setTenantModel("user-1", "m1", { paidPlan: true })).rejects.toBeInstanceOf(
      AiModelError
    );
  });

  it("refuses an inactive model", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(row({ active: false }));
    await expect(setTenantModel("user-1", "m1", { paidPlan: true })).rejects.toBeInstanceOf(
      AiModelError
    );
  });

  it("refuses a model that does not exist", async () => {
    (prisma.aiModel.findFirst as any).mockResolvedValue(null);
    await expect(setTenantModel("user-1", "nope", { paidPlan: true })).rejects.toBeInstanceOf(
      AiModelError
    );
  });
});

describe("estimatePointsPerImage", () => {
  it("uses the same function that actually charges, not a second formula", () => {
    const pricing = { inPerMTok: 5, outPerMTok: 25, pointsPerUsd: 1_000 };
    const estimate = estimatePointsPerImage(pricing);
    expect(estimate).toBe(
      costForUsage({ usage: { promptTokens: 1_200, completionTokens: 150 }, pricing })
    );
  });

  it("puts an Opus-class model an order of magnitude above a flash-class one", () => {
    const cheap = estimatePointsPerImage({ inPerMTok: 0.25, outPerMTok: 1.5, pointsPerUsd: 1_000 });
    const dear = estimatePointsPerImage({ inPerMTok: 5, outPerMTok: 25, pointsPerUsd: 1_000 });
    expect(cheap).toBe(1);
    expect(dear).toBe(10);
  });
});
