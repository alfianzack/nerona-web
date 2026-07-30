import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    agentProfile: { groupBy: vi.fn() },
  },
}));

import {
  DEFAULT_AGENT_MONTHLY_PRICES,
  agentMonthlyPrice,
  agentPriceSettingKey,
  getAgentPricingView,
  updateAgentPrice,
} from "@/lib/agent-pricing";
import { prisma } from "@/lib/prisma";

const findUnique = prisma.setting.findUnique as any;
const findMany = prisma.setting.findMany as any;
const upsert = prisma.setting.upsert as any;
const groupBy = prisma.agentProfile.groupBy as any;

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
  findMany.mockResolvedValue([]);
  groupBy.mockResolvedValue([]);
  delete process.env.PRICE_PLAN_AGENT_PRO;
});

describe("agentMonthlyPrice", () => {
  it("uses the code default when nothing is stored", async () => {
    expect(await agentMonthlyPrice("pro")).toBe(DEFAULT_AGENT_MONTHLY_PRICES.pro);
  });

  it("prefers the stored Setting over env and default", async () => {
    process.env.PRICE_PLAN_AGENT_PRO = "77000";
    findUnique.mockResolvedValue({ value: "59000" });
    expect(await agentMonthlyPrice("pro")).toBe(59_000);
  });

  it("falls back to env when the Setting is blank", async () => {
    process.env.PRICE_PLAN_AGENT_PRO = "77000";
    findUnique.mockResolvedValue({ value: "   " });
    expect(await agentMonthlyPrice("pro")).toBe(77_000);
  });

  it("treats a non-numeric stored value as unset rather than as zero", async () => {
    // Nol berarti gratis. Nilai rusak yang terbaca nol akan menggratiskan paket
    // berbayar tanpa ada yang menyadarinya.
    findUnique.mockResolvedValue({ value: "Rp 59.000/bulan" });
    expect(await agentMonthlyPrice("pro")).toBe(DEFAULT_AGENT_MONTHLY_PRICES.pro);
  });

  it("keeps zero as a real price for the free plan", async () => {
    findUnique.mockResolvedValue({ value: "0" });
    expect(await agentMonthlyPrice("free")).toBe(0);
  });

  it("accepts a capitalised plan name — metadata plans are stored that way", async () => {
    await agentMonthlyPrice("Pro");
    expect(findUnique).toHaveBeenCalledWith({ where: { key: "price_plan_agent_pro" } });
  });

  it("returns null for an unknown plan instead of inventing a price", async () => {
    expect(await agentMonthlyPrice("enterprise")).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("getAgentPricingView", () => {
  it("reports the stored text and the price actually in force separately", async () => {
    findMany.mockResolvedValue([{ key: agentPriceSettingKey("pro"), value: "59000" }]);
    groupBy.mockResolvedValue([{ plan: "pro", _count: { _all: 4 } }]);

    const rows = await getAgentPricingView();
    expect(rows.find((r) => r.plan === "pro")).toMatchObject({
      label: "Pro",
      stored: "59000",
      effective: 59_000,
      activeProfiles: 4,
    });

    // Baris yang belum diatur harus tampil kosong tapi tetap melaporkan harga hidup.
    const free = rows.find((r) => r.plan === "free")!;
    expect(free.stored).toBe("");
    expect(free.effective).toBe(DEFAULT_AGENT_MONTHLY_PRICES.free);
    expect(free.activeProfiles).toBe(0);
  });

  it("covers every plan that has a default", async () => {
    const rows = await getAgentPricingView();
    expect(rows.map((r) => r.plan)).toEqual(Object.keys(DEFAULT_AGENT_MONTHLY_PRICES));
  });
});

describe("updateAgentPrice", () => {
  it("normalises what the owner typed into digits before storing", async () => {
    expect(await updateAgentPrice("pro", "  Rp 59.000  ")).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith({
      where: { key: "price_plan_agent_pro" },
      create: { key: "price_plan_agent_pro", value: "59000" },
      update: { value: "59000" },
    });
  });

  it("stores an empty string to clear back to the default", async () => {
    await updateAgentPrice("business", "");
    expect(upsert.mock.calls[0][0].update).toEqual({ value: "" });
  });

  it("rejects text that is not a price instead of storing it", async () => {
    expect(await updateAgentPrice("pro", "gratis dong")).toEqual({ ok: false, reason: "invalid" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a plan that does not exist instead of creating one", async () => {
    expect(await updateAgentPrice("enterprise", "1000")).toEqual({ ok: false, reason: "not_found" });
    expect(upsert).not.toHaveBeenCalled();
  });
});
