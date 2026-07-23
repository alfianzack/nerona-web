import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getAiSettings, updateAiSettings, getAiSettingsView } from "@/lib/ai-settings";
import { prisma } from "@/lib/prisma";

const OLD_ENV = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("getAiSettings", () => {
  it("returns stored model and key", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: "ai_model", value: "gpt-5" },
      { key: "ai_api_key", value: "sk-live-1234" },
    ]);
    expect(await getAiSettings()).toEqual({ model: "gpt-5", apiKey: "sk-live-1234" });
  });

  it("falls back to env/default when rows are blank/absent", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);
    delete process.env.AGENT_MODEL;
    process.env.SUMOPOD_API_KEY = "env-key";
    expect(await getAiSettings()).toEqual({ model: "gemini-2.0-flash-lite", apiKey: "env-key" });
  });
});

describe("updateAiSettings", () => {
  it("upserts the model and the key when the key is non-empty", async () => {
    await updateAiSettings({ model: "gpt-5", apiKey: "sk-new" });
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
  });

  it("does NOT write the key when it is blank/absent", async () => {
    await updateAiSettings({ model: "gpt-5" });
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(1);
    const call = (prisma.setting.upsert as any).mock.calls[0][0];
    expect(call.where.key).toBe("ai_model");
  });
});

describe("getAiSettingsView", () => {
  it("masks the key, never returns raw, and reports apiKeySet", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: "ai_model", value: "gpt-5" },
      { key: "ai_api_key", value: "sk-live-abcd" },
    ]);
    const view = await getAiSettingsView();
    expect(view).toEqual({ model: "gpt-5", apiKeyMasked: "****abcd", apiKeySet: true });
    expect(JSON.stringify(view)).not.toContain("sk-live-abcd");
  });

  it("reports apiKeySet false and empty mask when no key stored and no env", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);
    delete process.env.SUMOPOD_API_KEY;
    const view = await getAiSettingsView();
    expect(view.apiKeySet).toBe(false);
    expect(view.apiKeyMasked).toBe("");
  });
});
