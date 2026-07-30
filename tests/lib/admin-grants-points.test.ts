import { beforeEach, describe, expect, it, vi } from "vitest";

const creditPlanPointsMock = vi.fn(async () => 5_000);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    license: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    order: { create: vi.fn() },
  },
}));
vi.mock("@/lib/license", () => ({ generateLicenseKey: vi.fn(async () => "KEY-1") }));
vi.mock("@/lib/plan-points", () => ({
  creditPlanPoints: (...args: unknown[]) => creditPlanPointsMock(...(args as [])),
}));

import { grantLicense } from "@/lib/admin-grants";
import { prisma } from "@/lib/prisma";

function happyPath() {
  (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "t@example.com" });
  (prisma.plan.findUnique as any).mockResolvedValue({
    id: "plan-pro",
    name: "Pro",
    marketplaces: "*",
    rejectAnalyzer: false,
  });
  (prisma.license.findFirst as any).mockResolvedValue(null);
}

describe("grantLicense point allowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditPlanPointsMock.mockResolvedValue(5_000);
  });

  it("credits the metadata allowance so the tenant is not left with an empty wallet", async () => {
    happyPath();

    const result = await grantLicense("admin-1", "t@example.com", "plan-pro");

    expect(result).toEqual({ ok: true });
    expect(creditPlanPointsMock).toHaveBeenCalledWith({
      userId: "user-1",
      product: "metadata",
      // The Plan table stores "Pro"; creditPlanPoints normalises it.
      plan: "Pro",
      // Pemberian manual admin tanpa durasi tetap satu bulan.
      durationMonths: 1,
      createdById: "admin-1",
      isRenewal: false,
    });
  });

  it("labels a renewal when the caller says so", async () => {
    happyPath();

    await grantLicense("admin-1", "t@example.com", "plan-pro", { isRenewal: true });

    expect(creditPlanPointsMock).toHaveBeenCalledWith(
      expect.objectContaining({ isRenewal: true })
    );
  });

  it("credits nothing when the user does not exist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await grantLicense("admin-1", "nobody@example.com", "plan-pro");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
    expect(creditPlanPointsMock).not.toHaveBeenCalled();
  });

  it("credits nothing when the plan does not exist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "t@example.com" });
    (prisma.plan.findUnique as any).mockResolvedValue(null);

    const result = await grantLicense("admin-1", "t@example.com", "missing");

    expect(result).toEqual({ ok: false, reason: "plan_not_found" });
    expect(creditPlanPointsMock).not.toHaveBeenCalled();
  });
});
