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

    const result = await updatePlanPrice("missing", "Rp 99.000/bulan");

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(prisma.plan.update).not.toHaveBeenCalled();
  });

  it("updates the priceLabel", async () => {
    (prisma.plan.findUnique as any).mockResolvedValue({ id: "plan-1" });

    const result = await updatePlanPrice("plan-1", "Rp 149.000/bulan");

    expect(result).toEqual({ ok: true });
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { priceLabel: "Rp 149.000/bulan" },
    });
  });

  it("stores an empty string as null", async () => {
    (prisma.plan.findUnique as any).mockResolvedValue({ id: "plan-1" });

    const result = await updatePlanPrice("plan-1", "   ");

    expect(result).toEqual({ ok: true });
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { priceLabel: null },
    });
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
