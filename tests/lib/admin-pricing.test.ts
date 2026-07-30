import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findUnique: vi.fn(), update: vi.fn() },
    course: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { updatePlanPrice, updateCoursePrice } from "@/lib/admin-pricing";
import { prisma } from "@/lib/prisma";

describe("updatePlanPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found for an unknown plan id", async () => {
    (prisma.plan.findUnique as any).mockResolvedValue(null);

    const result = await updatePlanPrice("missing", "99000");

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(prisma.plan.update).not.toHaveBeenCalled();
  });

  it("stores the monthly price as a number", async () => {
    (prisma.plan.findUnique as any).mockResolvedValue({ id: "plan-1" });

    const result = await updatePlanPrice("plan-1", "Rp 149.000");

    expect(result).toEqual({ ok: true });
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { priceMonthly: 149_000 },
    });
  });

  it("stores an empty string as null", async () => {
    (prisma.plan.findUnique as any).mockResolvedValue({ id: "plan-1" });

    const result = await updatePlanPrice("plan-1", "   ");

    expect(result).toEqual({ ok: true });
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { priceMonthly: null },
    });
  });

  it("rejects a price it cannot read, before touching the database", async () => {
    // "Rp 149.000/bulan" dulu sah sebagai teks. Sekarang tidak, dan menyimpannya
    // diam-diam sebagai 149000 akan menebak maksud owner — lebih baik ditolak.
    const result = await updatePlanPrice("plan-1", "seratus ribu");

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(prisma.plan.findUnique).not.toHaveBeenCalled();
    expect(prisma.plan.update).not.toHaveBeenCalled();
  });
});

describe("updateCoursePrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found for an unknown course id", async () => {
    (prisma.course.findUnique as any).mockResolvedValue(null);

    const result = await updateCoursePrice("missing", "Rp 99.000");

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it("updates the priceLabel", async () => {
    (prisma.course.findUnique as any).mockResolvedValue({ id: "course-1" });

    const result = await updateCoursePrice("course-1", "Rp 199.000");

    expect(result).toEqual({ ok: true });
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: "course-1" },
      data: { priceLabel: "Rp 199.000" },
    });
  });

  it("stores an empty string as null", async () => {
    (prisma.course.findUnique as any).mockResolvedValue({ id: "course-1" });

    const result = await updateCoursePrice("course-1", "");

    expect(result).toEqual({ ok: true });
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: "course-1" },
      data: { priceLabel: null },
    });
  });
});
