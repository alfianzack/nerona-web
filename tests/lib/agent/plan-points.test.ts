import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { pointTransaction: { create: vi.fn() } },
}));

import {
  AGENT_PLAN_POINTS,
  creditAgentPlanPoints,
  pointsForAgentPlan,
} from "@/lib/agent/plan-points";
import { prisma } from "@/lib/prisma";

describe("pointsForAgentPlan", () => {
  it("covers each plan's monthly message cap", () => {
    expect(pointsForAgentPlan("free")).toBe(1_000);
    expect(pointsForAgentPlan("pro")).toBe(11_000);
    expect(pointsForAgentPlan("business")).toBe(30_000);
  });

  it("grants nothing for an unknown plan rather than guessing", () => {
    expect(pointsForAgentPlan("enterprise")).toBe(0);
    expect(pointsForAgentPlan("")).toBe(0);
  });

  it("never exposes a negative or fractional allowance", () => {
    for (const amount of Object.values(AGENT_PLAN_POINTS)) {
      expect(Number.isInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThan(0);
    }
  });
});

describe("creditAgentPlanPoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("credits the plan allowance to the tenant's wallet", async () => {
    const credited = await creditAgentPlanPoints({
      userId: "user-1",
      plan: "pro",
      createdById: "admin-1",
    });

    expect(credited).toBe(11_000);
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        delta: 11_000,
        reason: "plan_grant",
        note: "Bonus paket Pro",
        createdById: "admin-1",
      },
    });
  });

  it("labels a renewal so the ledger distinguishes it", async () => {
    await creditAgentPlanPoints({
      userId: "user-1",
      plan: "pro",
      createdById: "admin-1",
      isRenewal: true,
    });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: "Perpanjangan paket Pro" }),
      })
    );
  });

  it("allows a self-service activation with no admin attached", async () => {
    await creditAgentPlanPoints({ userId: "user-1", plan: "free" });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: 1_000, createdById: null }),
      })
    );
  });

  it("writes nothing for an unknown plan", async () => {
    const credited = await creditAgentPlanPoints({ userId: "user-1", plan: "mystery" });

    expect(credited).toBe(0);
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });
});
