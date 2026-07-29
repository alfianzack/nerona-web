import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    license: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollment: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    order: { create: vi.fn() },
    // grantLicense credits the metadata allowance, which reads the configured
    // amount and writes a ledger row. null means the code default applies.
    setting: { findUnique: vi.fn(async () => null) },
    pointTransaction: { create: vi.fn() },
  },
}));
vi.mock("@/lib/license", () => ({ generateLicenseKey: vi.fn() }));

import {
  grantLicense,
  revokeLicense,
  grantEnrollment,
  revokeEnrollment,
} from "@/lib/admin-grants";
import { prisma } from "@/lib/prisma";
import { generateLicenseKey } from "@/lib/license";

describe("grantLicense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // `name` is non-nullable in the schema and is what the point allowance is
  // looked up by, so the fixture has to carry it.
  const plan = { id: "plan-1", name: "Pro", marketplaces: "*", rejectAnalyzer: true };

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await grantLicense("admin-1", "missing@example.com", "plan-1");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it("returns plan_not_found when no Plan matches the id", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.plan.findUnique as any).mockResolvedValue(null);

    const result = await grantLicense("admin-1", "user@example.com", "missing-plan");

    expect(result).toEqual({ ok: false, reason: "plan_not_found" });
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it("creates a new License with a fresh key when the user has none", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.plan.findUnique as any).mockResolvedValue(plan);
    (prisma.license.findFirst as any).mockResolvedValue(null);
    (generateLicenseKey as any).mockResolvedValue("NERONA-AAAA-BBBB-CCCC");

    const result = await grantLicense("admin-1", "user@example.com", "plan-1", {
      note: "paid via bank transfer",
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.license.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        licenseKey: "NERONA-AAAA-BBBB-CCCC",
        status: "active",
        source: "manual_grant",
        grantedById: "admin-1",
        notes: "paid via bank transfer",
        planId: "plan-1",
        marketplaces: "*",
        rejectAnalyzer: true,
        validUntil: expect.any(Date),
      },
    });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("updates the existing License in place instead of creating a duplicate", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.plan.findUnique as any).mockResolvedValue(plan);
    (prisma.license.findFirst as any).mockResolvedValue({ id: "license-1" });

    const result = await grantLicense("admin-1", "user@example.com", "plan-1");

    expect(result).toEqual({ ok: true });
    expect(prisma.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: {
        status: "active",
        source: "manual_grant",
        grantedById: "admin-1",
        notes: undefined,
        planId: "plan-1",
        marketplaces: "*",
        rejectAnalyzer: true,
        validUntil: expect.any(Date),
      },
    });
    expect(prisma.license.create).not.toHaveBeenCalled();
  });

  it("honors an explicit validUntil override instead of the month-end default", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.plan.findUnique as any).mockResolvedValue(plan);
    (prisma.license.findFirst as any).mockResolvedValue({ id: "license-1" });
    const overrideDate = new Date("2026-09-15T00:00:00.000Z");

    const result = await grantLicense("admin-1", "user@example.com", "plan-1", {
      validUntil: overrideDate,
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: {
        status: "active",
        source: "manual_grant",
        grantedById: "admin-1",
        notes: undefined,
        planId: "plan-1",
        marketplaces: "*",
        rejectAnalyzer: true,
        validUntil: overrideDate,
      },
    });
  });

  it("honors an explicit validUntil override on create as well", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.plan.findUnique as any).mockResolvedValue(plan);
    (prisma.license.findFirst as any).mockResolvedValue(null);
    (generateLicenseKey as any).mockResolvedValue("NERONA-AAAA-BBBB-CCCC");
    const overrideDate = new Date("2026-09-15T00:00:00.000Z");

    await grantLicense("admin-1", "user@example.com", "plan-1", { validUntil: overrideDate });

    expect(prisma.license.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ validUntil: overrideDate }),
    });
  });

  it("creates an Order row when an amount is supplied", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.plan.findUnique as any).mockResolvedValue(plan);
    (prisma.license.findFirst as any).mockResolvedValue({ id: "license-1" });

    await grantLicense("admin-1", "user@example.com", "plan-1", {
      amount: 150000,
      currency: "idr",
    });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: { userId: "user-1", amount: 150000, currency: "idr", note: undefined },
    });
  });
});

describe("revokeLicense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await revokeLicense("missing@example.com");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
  });

  it("returns license_not_found when the user has no License", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.license.findFirst as any).mockResolvedValue(null);

    const result = await revokeLicense("user@example.com");

    expect(result).toEqual({ ok: false, reason: "license_not_found" });
  });

  it("sets status to revoked when a License exists", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.license.findFirst as any).mockResolvedValue({ id: "license-1" });

    const result = await revokeLicense("user@example.com");

    expect(result).toEqual({ ok: true });
    expect(prisma.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: { status: "revoked" },
    });
  });
});

describe("grantEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await grantEnrollment("admin-1", "missing@example.com", "course-1");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("returns course_not_found when no Course matches the id", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.course.findUnique as any).mockResolvedValue(null);

    const result = await grantEnrollment("admin-1", "user@example.com", "course-1");

    expect(result).toEqual({ ok: false, reason: "course_not_found" });
    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("upserts the Enrollment with source manual_grant", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.course.findUnique as any).mockResolvedValue({ id: "course-1" });

    const result = await grantEnrollment("admin-1", "user@example.com", "course-1");

    expect(result).toEqual({ ok: true });
    expect(prisma.enrollment.upsert).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user-1", courseId: "course-1" } },
      update: { source: "manual_grant" },
      create: { userId: "user-1", courseId: "course-1", source: "manual_grant" },
    });
  });

  it("creates an Order row tagged with the courseId when an amount is supplied", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.course.findUnique as any).mockResolvedValue({ id: "course-1" });

    await grantEnrollment("admin-1", "user@example.com", "course-1", { amount: 99000 });

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: { userId: "user-1", courseId: "course-1", amount: 99000, currency: "idr", note: undefined },
    });
  });
});

describe("revokeEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user_not_found when no User matches the email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await revokeEnrollment("missing@example.com", "course-1");

    expect(result).toEqual({ ok: false, reason: "user_not_found" });
  });

  it("returns enrollment_not_found when no Enrollment row exists", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.enrollment.findUnique as any).mockResolvedValue(null);

    const result = await revokeEnrollment("user@example.com", "course-1");

    expect(result).toEqual({ ok: false, reason: "enrollment_not_found" });
  });

  it("deletes the Enrollment row when it exists", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "enrollment-1" });

    const result = await revokeEnrollment("user@example.com", "course-1");

    expect(result).toEqual({ ok: true });
    expect(prisma.enrollment.delete).toHaveBeenCalledWith({ where: { id: "enrollment-1" } });
  });
});
