import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    pointTransaction: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import {
  DEFAULT_PLAN_POINTS,
  creditPlanPoints,
  getPlanPointsView,
  hasEverReceivedPlanGrant,
  normalizePlan,
  planGrantFilter,
  pointsForPlan,
  settingKey,
  updatePlanPoints,
} from "@/lib/plan-points";
import { prisma } from "@/lib/prisma";

/** No Setting row stored — the chain falls through to env or the default. */
function noStoredValue() {
  (prisma.setting.findUnique as any).mockResolvedValue(null);
}

function storedValue(value: string) {
  (prisma.setting.findUnique as any).mockResolvedValue({ key: "k", value });
}

describe("normalizePlan", () => {
  it("folds the metadata table's capitalisation to the agent convention", () => {
    // Plan rows are seeded as "Free"/"Pro"/"Business"; agent plans are lowercase.
    expect(normalizePlan("Pro")).toBe("pro");
    expect(normalizePlan("  Business ")).toBe("business");
    expect(normalizePlan("free")).toBe("free");
  });
});

describe("settingKey", () => {
  it("builds one flat key per product and plan", () => {
    expect(settingKey("metadata", "Pro")).toBe("points_plan_metadata_pro");
    expect(settingKey("agent", "business")).toBe("points_plan_agent_business");
  });
});

describe("DEFAULT_PLAN_POINTS", () => {
  it("uses the owner's agent figures", () => {
    expect(DEFAULT_PLAN_POINTS.agent).toEqual({ free: 15, pro: 600, business: 1_500 });
  });

  it("uses the owner's metadata figures, with Free as a lifetime trial", () => {
    expect(DEFAULT_PLAN_POINTS.metadata).toEqual({ free: 10, pro: 500, business: 1_000 });
  });

  it("never ships a negative or fractional allowance", () => {
    for (const plans of Object.values(DEFAULT_PLAN_POINTS)) {
      for (const amount of Object.values(plans)) {
        expect(Number.isInteger(amount)).toBe(true);
        expect(amount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("pointsForPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POINTS_PLAN_METADATA_PRO;
  });

  it("falls back to the code default when nothing is stored", async () => {
    noStoredValue();
    expect(await pointsForPlan("metadata", "pro")).toBe(500);
    expect(await pointsForPlan("agent", "free")).toBe(15);
  });

  it("accepts the metadata table's capitalisation", async () => {
    noStoredValue();
    expect(await pointsForPlan("metadata", "Pro")).toBe(500);
    expect(await pointsForPlan("metadata", "Business")).toBe(1_000);
  });

  it("prefers a stored value over the default", async () => {
    storedValue("777");
    expect(await pointsForPlan("metadata", "pro")).toBe(777);
  });

  it("honours a stored zero as a real allowance of nothing", async () => {
    storedValue("0");
    expect(await pointsForPlan("metadata", "pro")).toBe(0);
  });

  it("falls through to env when nothing is stored", async () => {
    noStoredValue();
    process.env.POINTS_PLAN_METADATA_PRO = "2500";
    expect(await pointsForPlan("metadata", "pro")).toBe(2_500);
  });

  it("ignores stored junk rather than granting a broken amount", async () => {
    for (const junk of ["", "   ", "-5", "abc", "1.5"]) {
      storedValue(junk);
      expect(await pointsForPlan("metadata", "pro")).toBe(500);
    }
  });

  it("grants nothing for an unknown plan rather than guessing", async () => {
    noStoredValue();
    expect(await pointsForPlan("agent", "enterprise")).toBe(0);
    expect(await pointsForPlan("metadata", "")).toBe(0);
  });

  it("does not query Setting for a plan that has no allowance at all", async () => {
    noStoredValue();
    await pointsForPlan("agent", "enterprise");
    expect(prisma.setting.findUnique).not.toHaveBeenCalled();
  });
});

describe("creditPlanPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noStoredValue();
  });

  it("credits the allowance and names the product in the ledger", async () => {
    // Both products have a "Pro"; the note has to say which one.
    const credited = await creditPlanPoints({
      userId: "user-1",
      product: "agent",
      plan: "pro",
      createdById: "admin-1",
    });

    expect(credited).toBe(600);
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        delta: 600,
        reason: "plan_grant",
        note: "Bonus paket Agent Pro",
        createdById: "admin-1",
      },
    });
  });

  it("labels a renewal so the ledger distinguishes it", async () => {
    await creditPlanPoints({
      userId: "user-1",
      product: "metadata",
      plan: "Business",
      createdById: "admin-1",
      isRenewal: true,
    });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: 1_000,
          note: "Perpanjangan paket Metadata Business",
        }),
      })
    );
  });

  it("allows a self-service activation with no admin attached", async () => {
    await creditPlanPoints({ userId: "user-1", product: "agent", plan: "free" });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: 15, createdById: null }),
      })
    );
  });

  it("writes nothing for an unknown plan", async () => {
    const credited = await creditPlanPoints({ userId: "user-1", product: "agent", plan: "mystery" });

    expect(credited).toBe(0);
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });

  it("writes nothing when the allowance is configured to zero", async () => {
    storedValue("0");
    const credited = await creditPlanPoints({ userId: "user-1", product: "metadata", plan: "pro" });

    expect(credited).toBe(0);
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });
});

describe("getPlanPointsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POINTS_PLAN_METADATA_PRO;
  });

  it("returns one row per product and plan, with stored blank when unset", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);

    const rows = await getPlanPointsView();

    expect(rows).toHaveLength(6);
    const metaPro = rows.find((r) => r.product === "metadata" && r.plan === "pro");
    expect(metaPro).toEqual({
      product: "metadata",
      plan: "pro",
      label: "Pro",
      stored: "",
      effective: 500,
    });
  });

  it("reports the stored value and the effective figure separately", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: "points_plan_metadata_pro", value: "777" },
    ]);

    const rows = await getPlanPointsView();
    const metaPro = rows.find((r) => r.product === "metadata" && r.plan === "pro");

    expect(metaPro?.stored).toBe("777");
    expect(metaPro?.effective).toBe(777);
  });

  it("shows the effective figure coming from env while stored stays blank", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([]);
    process.env.POINTS_PLAN_METADATA_PRO = "2500";

    const rows = await getPlanPointsView();
    const metaPro = rows.find((r) => r.product === "metadata" && r.plan === "pro");

    expect(metaPro?.stored).toBe("");
    expect(metaPro?.effective).toBe(2_500);
  });
});

describe("updatePlanPoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes one Setting row per value in a single transaction", async () => {
    await updatePlanPoints([
      { product: "metadata", plan: "pro", value: "777" },
      { product: "agent", plan: "free", value: "" },
    ]);

    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: "points_plan_metadata_pro" },
      create: { key: "points_plan_metadata_pro", value: "777" },
      update: { value: "777" },
    });
    // "" is a deliberate clear back to the env/default fallback, not a no-op.
    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: "points_plan_agent_free" },
      create: { key: "points_plan_agent_free", value: "" },
      update: { value: "" },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("ignores a product or plan that has no allowance to configure", async () => {
    await updatePlanPoints([{ product: "agent", plan: "enterprise", value: "10" }]);

    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });
});

describe("planGrantFilter", () => {
  it("matches every grant for one product, initial and renewal alike", () => {
    // Notes read "Bonus paket Metadata Pro" / "Perpanjangan paket Metadata Pro",
    // so the shared phrase is "paket <Product>".
    expect(planGrantFilter("metadata")).toEqual({
      reason: "plan_grant",
      note: { contains: "paket Metadata" },
    });
    expect(planGrantFilter("agent")).toEqual({
      reason: "plan_grant",
      note: { contains: "paket Agent" },
    });
  });
});

describe("hasEverReceivedPlanGrant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is true when a matching grant exists", async () => {
    (prisma.pointTransaction.findFirst as any).mockResolvedValue({ id: "pt-1" });

    expect(await hasEverReceivedPlanGrant("user-1", "metadata")).toBe(true);
    expect(prisma.pointTransaction.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", ...planGrantFilter("metadata") },
      select: { id: true },
    });
  });

  it("is false when the account has no such grant", async () => {
    (prisma.pointTransaction.findFirst as any).mockResolvedValue(null);

    expect(await hasEverReceivedPlanGrant("user-1", "agent")).toBe(false);
  });

  it("scopes the query per product so one does not mask the other", async () => {
    (prisma.pointTransaction.findFirst as any).mockResolvedValue(null);

    await hasEverReceivedPlanGrant("user-1", "agent");

    expect(prisma.pointTransaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ note: { contains: "paket Agent" } }),
      })
    );
  });
});
