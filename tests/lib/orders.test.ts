import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findFirst: vi.fn() },
    license: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    agentProfile: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    orderRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    pointTransaction: { create: vi.fn() },
    // creditPlanPoints reads the configured allowance; null means the code
    // default applies, which is what these expectations are written against.
    setting: { findUnique: vi.fn(async () => null) },
  },
}));
vi.mock("@/lib/license", () => ({ generateLicenseKey: vi.fn() }));
vi.mock("@/lib/admin-grants", () => ({ grantLicense: vi.fn() }));

import { cancelOrderRequest, fulfillOrderRequest, submitOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { generateLicenseKey } from "@/lib/license";
import { grantLicense } from "@/lib/admin-grants";
import { renewedExpiryFrom } from "@/lib/billing-period";

describe("submitOrder — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unknown product", async () => {
    expect(await submitOrder("user-1", "courses", "Pro")).toEqual({
      ok: false,
      reason: "invalid_product",
    });
  });

  it("rejects an unknown plan", async () => {
    expect(await submitOrder("user-1", "metadata", "Ultimate")).toEqual({
      ok: false,
      reason: "invalid_plan",
    });
  });
});

describe("submitOrder — Free metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns plan_not_found when the Free plan isn't seeded", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue(null);

    expect(await submitOrder("user-1", "metadata", "Free")).toEqual({
      ok: false,
      reason: "plan_not_found",
    });
  });

  it("never downgrades an existing active license", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-free" });
    (prisma.license.findFirst as any).mockResolvedValue({ id: "lic-1", status: "active" });

    const result = await submitOrder("user-1", "metadata", "Free");

    expect(result).toEqual({ ok: true, kind: "free_activated" });
    expect(prisma.license.update).not.toHaveBeenCalled();
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it("creates a fresh free license when the user has none", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({
      id: "plan-free",
      marketplaces: "adobe",
      rejectAnalyzer: false,
    });
    (prisma.license.findFirst as any).mockResolvedValue(null);
    (generateLicenseKey as any).mockResolvedValue("NERONA-FREE-AAAA-BBBB");

    const result = await submitOrder("user-1", "metadata", "Free");

    expect(result).toEqual({ ok: true, kind: "free_activated" });
    expect(prisma.license.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        licenseKey: "NERONA-FREE-AAAA-BBBB",
        status: "active",
        source: "free_signup",
        planId: "plan-free",
      }),
    });
  });
});

describe("submitOrder — Free agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses when the profile was disabled by an admin", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ id: "p1", status: "disabled" });

    expect(await submitOrder("user-1", "agent", "Free")).toEqual({
      ok: false,
      reason: "account_disabled",
    });
  });

  it("creates an active free profile when none exists", async () => {
    (prisma.agentProfile.findUnique as any).mockResolvedValue(null);

    const result = await submitOrder("user-1", "agent", "Free");

    expect(result).toEqual({ ok: true, kind: "free_activated" });
    expect(prisma.agentProfile.create).toHaveBeenCalledWith({
      data: { userId: "user-1", status: "active", plan: "free", planExpiresAt: null },
    });
  });
});

describe("submitOrder — paid plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a duplicate pending request for the same product", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-pro" });
    (prisma.orderRequest.findFirst as any).mockResolvedValue({ id: "req-1" });

    expect(await submitOrder("user-1", "metadata", "Pro")).toEqual({
      ok: false,
      reason: "already_pending",
      orderId: "req-1",
    });
    expect(prisma.orderRequest.create).not.toHaveBeenCalled();
  });

  it("creates a pending request with the contact note", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-pro" });
    (prisma.orderRequest.findFirst as any).mockResolvedValue(null);
    (prisma.orderRequest.create as any).mockResolvedValue({ id: "req-new" });

    const result = await submitOrder("user-1", "metadata", "Pro", "WA 0812...");

    expect(result).toEqual({ ok: true, kind: "request_created", orderId: "req-new" });
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "user-1", product: "metadata", planName: "Pro", contactNote: "WA 0812..." },
    });
  });
});

describe("fulfillOrderRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns order_not_found for a missing order", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue(null);

    expect(await fulfillOrderRequest("admin-1", "req-x")).toEqual({
      ok: false,
      reason: "order_not_found",
    });
  });

  it("refuses to fulfill a non-pending order", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-1",
      status: "fulfilled",
      user: { id: "user-1", email: "a@b.c" },
    });

    expect(await fulfillOrderRequest("admin-1", "req-1")).toEqual({
      ok: false,
      reason: "not_pending",
    });
  });

  it("credits the plan's points when an agent order is fulfilled", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-a",
      status: "pending",
      product: "agent",
      planName: "Pro",
      isRenewal: false,
      user: { id: "user-1", email: "a@b.c" },
    });

    const result = await fulfillOrderRequest("admin-1", "req-a");

    expect(result).toEqual({ ok: true });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        delta: 11_000,
        reason: "plan_grant",
        note: "Bonus paket Agent Pro",
        createdById: "admin-1",
      },
    });
  });

  it("labels the credit as a renewal when renewing an agent plan", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-b",
      status: "pending",
      product: "agent",
      planName: "Pro",
      isRenewal: true,
      user: { id: "user-1", email: "a@b.c" },
    });
    (prisma.agentProfile.findUnique as any).mockResolvedValue({ planExpiresAt: null });

    await fulfillOrderRequest("admin-1", "req-b");

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: 11_000, note: "Perpanjangan paket Agent Pro" }),
      })
    );
  });

  it("grants a metadata license via the admin-grant path and marks fulfilled", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-1",
      status: "pending",
      product: "metadata",
      planName: "Pro",
      isRenewal: false,
      user: { id: "user-1", email: "a@b.c" },
    });
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-pro" });
    (grantLicense as any).mockResolvedValue({ ok: true });

    const result = await fulfillOrderRequest("admin-1", "req-1");

    expect(result).toEqual({ ok: true });
    expect(grantLicense).toHaveBeenCalledWith("admin-1", "a@b.c", "plan-pro", {
      note: "Order req-1",
      validUntil: undefined,
    });
    expect(prisma.license.findFirst).not.toHaveBeenCalled();
    expect(prisma.orderRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: expect.objectContaining({ status: "fulfilled", fulfilledById: "admin-1" }),
    });
  });

  it("renews a metadata license using renewedExpiryFrom the current validUntil", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-1r",
      status: "pending",
      product: "metadata",
      planName: "Pro",
      isRenewal: true,
      user: { id: "user-1", email: "a@b.c" },
    });
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-pro" });
    const currentValidUntil = new Date("2026-08-31T17:00:00.000Z");
    (prisma.license.findFirst as any).mockResolvedValue({
      validUntil: currentValidUntil,
    });
    (grantLicense as any).mockResolvedValue({ ok: true });
    // Fixture is future-dated relative to "now", so renewedExpiryFrom bases off the
    // fixture regardless of the real `now` used inside fulfillOrderRequest — computed
    // with the real (unmocked) helper, this pins the exact forward-stacked value and
    // would fail if the renewal branch regressed to monthlyExpiryFrom(now), a
    // month-end reset, instead.
    const expectedValidUntil = renewedExpiryFrom(currentValidUntil, new Date());
    expect(expectedValidUntil).toEqual(new Date("2026-09-30T17:00:00.000Z"));

    const result = await fulfillOrderRequest("admin-1", "req-1r");

    expect(result).toEqual({ ok: true });
    expect(prisma.license.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", status: { in: ["active", "comp"] } },
      orderBy: { createdAt: "desc" },
      select: { validUntil: true },
    });
    expect(grantLicense).toHaveBeenCalledWith("admin-1", "a@b.c", "plan-pro", {
      note: "Order req-1r",
      validUntil: expectedValidUntil,
    });
  });

  it("activates the agent profile with the lowercased plan name", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-2",
      status: "pending",
      product: "agent",
      planName: "Business",
      isRenewal: false,
      user: { id: "user-1", email: "a@b.c" },
    });

    const result = await fulfillOrderRequest("admin-1", "req-2");

    expect(result).toEqual({ ok: true });
    expect(prisma.agentProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.agentProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: { status: "active", plan: "business", planExpiresAt: expect.any(Date) },
      create: { userId: "user-1", status: "active", plan: "business", planExpiresAt: expect.any(Date) },
    });
  });

  it("renews the agent profile using renewedExpiryFrom the current planExpiresAt", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({
      id: "req-2r",
      status: "pending",
      product: "agent",
      planName: "Business",
      isRenewal: true,
      user: { id: "user-1", email: "a@b.c" },
    });
    const currentExpiry = new Date("2026-08-31T17:00:00.000Z");
    (prisma.agentProfile.findUnique as any).mockResolvedValue({
      planExpiresAt: currentExpiry,
    });
    // Fixture is future-dated relative to "now", so renewedExpiryFrom bases off the
    // fixture regardless of the real `now` used inside fulfillOrderRequest — computed
    // with the real (unmocked) helper, this pins the exact forward-stacked value and
    // would fail if the renewal branch regressed to monthlyExpiryFrom(now), a
    // month-end reset, instead.
    const expectedExpiresAt = renewedExpiryFrom(currentExpiry, new Date());
    expect(expectedExpiresAt).toEqual(new Date("2026-09-30T17:00:00.000Z"));

    const result = await fulfillOrderRequest("admin-1", "req-2r");

    expect(result).toEqual({ ok: true });
    expect(prisma.agentProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { planExpiresAt: true },
    });
    expect(prisma.agentProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: { status: "active", plan: "business", planExpiresAt: expectedExpiresAt },
      create: { userId: "user-1", status: "active", plan: "business", planExpiresAt: expectedExpiresAt },
    });
  });
});

describe("cancelOrderRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a pending order", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({ id: "req-1", status: "pending" });

    expect(await cancelOrderRequest("req-1")).toEqual({ ok: true });
    expect(prisma.orderRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { status: "cancelled" },
    });
  });

  it("refuses to cancel a fulfilled order", async () => {
    (prisma.orderRequest.findUnique as any).mockResolvedValue({ id: "req-1", status: "fulfilled" });

    expect(await cancelOrderRequest("req-1")).toEqual({ ok: false, reason: "not_pending" });
  });
});
