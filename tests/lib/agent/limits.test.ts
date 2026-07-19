import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentMessage: { count: vi.fn() },
  },
}));

import { hasExceededMonthlyLimit, monthlyLimitFor } from "@/lib/agent/limits";
import { prisma } from "@/lib/prisma";

describe("monthlyLimitFor", () => {
  it("maps known plans to their limits", () => {
    expect(monthlyLimitFor("free")).toBe(50);
    expect(monthlyLimitFor("pro")).toBe(500);
    expect(monthlyLimitFor("business")).toBeNull();
  });

  it("falls back to the free limit for unknown plans", () => {
    expect(monthlyLimitFor("mystery")).toBe(50);
  });
});

describe("hasExceededMonthlyLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false without querying for an unlimited plan", async () => {
    const result = await hasExceededMonthlyLimit("profile-1", "business");

    expect(result).toBe(false);
    expect(prisma.agentMessage.count).not.toHaveBeenCalled();
  });

  it("counts inbound messages since the start of the current month", async () => {
    (prisma.agentMessage.count as any).mockResolvedValue(10);
    const now = new Date("2026-07-19T10:00:00Z");

    await hasExceededMonthlyLimit("profile-1", "free", now);

    expect(prisma.agentMessage.count).toHaveBeenCalledWith({
      where: {
        profileId: "profile-1",
        direction: "in",
        createdAt: { gte: new Date(2026, 6, 1) },
      },
    });
  });

  it("allows exactly the limit and blocks past it", async () => {
    (prisma.agentMessage.count as any).mockResolvedValue(50);
    expect(await hasExceededMonthlyLimit("profile-1", "free")).toBe(false);

    (prisma.agentMessage.count as any).mockResolvedValue(51);
    expect(await hasExceededMonthlyLimit("profile-1", "free")).toBe(true);
  });
});
