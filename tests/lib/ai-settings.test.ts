import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getAiSettings, updateAiSettings, getAiSettingsView } from "@/lib/ai-settings";
import { DEFAULT_AI_PRICING } from "@/lib/agent/pricing";
import { prisma } from "@/lib/prisma";

const OLD_ENV = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});
afterEach(() => {
  process.env = { ...OLD_ENV };
});

function rows(map: Record<string, string>) {
  (prisma.setting.findMany as any).mockResolvedValue(
    Object.entries(map).map(([key, value]) => ({ key, value }))
  );
}

/** Only the price keys matter here; model/key are covered separately. */
async function pricing() {
  return (await getAiSettings()).pricing;
}

describe("getAiSettings", () => {
  it("returns stored model and key", async () => {
    rows({ ai_model: "gpt-5", ai_api_key: "sk-live-1234" });
    const settings = await getAiSettings();
    expect(settings.model).toBe("gpt-5");
    expect(settings.apiKey).toBe("sk-live-1234");
  });

  it("falls back to env/default when rows are blank/absent", async () => {
    rows({});
    delete process.env.AGENT_MODEL;
    process.env.SUMOPOD_API_KEY = "env-key";
    const settings = await getAiSettings();
    expect(settings.model).toBe("gemini-2.0-flash-lite");
    expect(settings.apiKey).toBe("env-key");
  });

  it("reads all five keys in a single query", async () => {
    rows({});
    await getAiSettings();
    expect(prisma.setting.findMany).toHaveBeenCalledTimes(1);
    const where = (prisma.setting.findMany as any).mock.calls[0][0].where;
    expect(where.key.in).toEqual(
      expect.arrayContaining(["ai_model", "ai_api_key", "ai_price_in", "ai_price_out", "points_per_usd"])
    );
  });
});

describe("getAiSettings pricing", () => {
  it("returns the stored rates", async () => {
    rows({ ai_price_in: "3", ai_price_out: "15", points_per_usd: "50000" });
    expect(await pricing()).toEqual({ inPerMTok: 3, outPerMTok: 15, pointsPerUsd: 50_000 });
  });

  it("accepts a zero rate as a real value (a free model)", async () => {
    rows({ ai_price_in: "0", ai_price_out: "0" });
    const p = await pricing();
    expect(p.inPerMTok).toBe(0);
    expect(p.outPerMTok).toBe(0);
  });

  it("falls back to env when a row is unset", async () => {
    rows({});
    process.env.AI_PRICE_IN = "1.5";
    process.env.AI_PRICE_OUT = "6";
    process.env.POINTS_PER_USD = "200000";
    expect(await pricing()).toEqual({ inPerMTok: 1.5, outPerMTok: 6, pointsPerUsd: 200_000 });
  });

  it("falls back to the code default when neither row nor env is set", async () => {
    rows({});
    delete process.env.AI_PRICE_IN;
    delete process.env.AI_PRICE_OUT;
    delete process.env.POINTS_PER_USD;
    expect(await pricing()).toEqual(DEFAULT_AI_PRICING);
  });

  it("treats a non-numeric or negative row as unset and keeps falling back", async () => {
    rows({ ai_price_in: "gratis", ai_price_out: "-2", points_per_usd: "  " });
    delete process.env.AI_PRICE_IN;
    delete process.env.AI_PRICE_OUT;
    delete process.env.POINTS_PER_USD;
    expect(await pricing()).toEqual(DEFAULT_AI_PRICING);
  });

  it("rejects a zero pointsPerUsd (that would make every call free)", async () => {
    rows({ points_per_usd: "0" });
    delete process.env.POINTS_PER_USD;
    expect((await pricing()).pointsPerUsd).toBe(DEFAULT_AI_PRICING.pointsPerUsd);
  });

  it("ignores a bad env value too", async () => {
    rows({});
    process.env.POINTS_PER_USD = "banyak";
    expect((await pricing()).pointsPerUsd).toBe(DEFAULT_AI_PRICING.pointsPerUsd);
  });
});

describe("updateAiSettings", () => {
  function upsertedKeys() {
    return (prisma.setting.upsert as any).mock.calls.map((c: any[]) => c[0].where.key);
  }

  it("upserts the model and the key when the key is non-empty", async () => {
    await updateAiSettings({ model: "gpt-5", apiKey: "sk-new" });
    expect(upsertedKeys()).toEqual(["ai_model", "ai_api_key"]);
  });

  it("does NOT write the key when it is blank/absent", async () => {
    await updateAiSettings({ model: "gpt-5" });
    expect(upsertedKeys()).toEqual(["ai_model"]);
  });

  it("writes the rates when they are provided", async () => {
    await updateAiSettings({ model: "gpt-5", priceIn: "3", priceOut: "15", pointsPerUsd: "50000" });
    expect(upsertedKeys()).toEqual(["ai_model", "ai_price_in", "ai_price_out", "points_per_usd"]);
    const call = (prisma.setting.upsert as any).mock.calls[1][0];
    expect(call.update.value).toBe("3");
  });

  it("clears a rate back to the fallback when passed a blank string", async () => {
    await updateAiSettings({ model: "gpt-5", priceIn: "" });
    expect(upsertedKeys()).toEqual(["ai_model", "ai_price_in"]);
    expect((prisma.setting.upsert as any).mock.calls[1][0].update.value).toBe("");
  });

  it("leaves a rate untouched when it is not passed", async () => {
    await updateAiSettings({ model: "gpt-5", priceIn: "3" });
    expect(upsertedKeys()).not.toContain("ai_price_out");
  });
});

describe("getAiSettingsView", () => {
  it("masks the key, never returns raw, and reports apiKeySet", async () => {
    rows({ ai_model: "gpt-5", ai_api_key: "sk-live-abcd" });
    const view = await getAiSettingsView();
    expect(view.model).toBe("gpt-5");
    expect(view.apiKeyMasked).toBe("****abcd");
    expect(view.apiKeySet).toBe(true);
    expect(JSON.stringify(view)).not.toContain("sk-live-abcd");
  });

  it("reports apiKeySet false and empty mask when no key stored and no env", async () => {
    rows({});
    delete process.env.SUMOPOD_API_KEY;
    const view = await getAiSettingsView();
    expect(view.apiKeySet).toBe(false);
    expect(view.apiKeyMasked).toBe("");
  });

  it("returns raw rates plus the effective ones so the panel can show both", async () => {
    rows({ ai_price_in: "3" });
    delete process.env.AI_PRICE_IN;
    delete process.env.AI_PRICE_OUT;
    delete process.env.POINTS_PER_USD;
    const view = await getAiSettingsView();
    expect(view.priceIn).toBe("3");
    expect(view.priceOut).toBe(""); // unset — the panel shows the effective value as placeholder
    expect(view.pointsPerUsd).toBe("");
    expect(view.effective).toEqual({ ...DEFAULT_AI_PRICING, inPerMTok: 3 });
  });
});
