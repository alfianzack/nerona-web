import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentProfile: { findMany: vi.fn() },
    license: { findMany: vi.fn() },
    orderRequest: { count: vi.fn(), create: vi.fn() },
  },
}));

import { generateDueRenewals } from "@/lib/billing/renewals";
import { prisma } from "@/lib/prisma";

const now = new Date("2026-07-29T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.agentProfile.findMany as any).mockResolvedValue([]);
  (prisma.license.findMany as any).mockResolvedValue([]);
  (prisma.orderRequest.count as any).mockResolvedValue(0);
});

describe("generateDueRenewals", () => {
  it("creates an agent renewal for a due paid profile with no pending request", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([{ userId: "u1", plan: "pro" }]);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "u1", product: "agent", planName: "Pro", isRenewal: true },
    });
    expect(res.created).toBe(1);
  });

  it("skips when a pending request already exists (idempotent)", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([{ userId: "u1", plan: "pro" }]);
    (prisma.orderRequest.count as any).mockResolvedValue(1);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).not.toHaveBeenCalled();
    expect(res.created).toBe(0);
  });

  it("creates a metadata renewal from an active license's plan name", async () => {
    (prisma.license.findMany as any).mockResolvedValue([{ userId: "u2", plan: { name: "Business" } }]);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "u2", product: "metadata", planName: "Business", isRenewal: true },
    });
    expect(res.created).toBe(1);
  });

  it("queries with a cutoff = now + leadDays and paid/active filters", async () => {
    await generateDueRenewals(now, 3);
    const agentWhere = (prisma.agentProfile.findMany as any).mock.calls[0][0].where;
    expect(agentWhere.status).toBe("active");
    expect(agentWhere.plan).toEqual({ in: ["pro", "business"] });
    expect(agentWhere.planExpiresAt.lte instanceof Date).toBe(true);
  });
});
