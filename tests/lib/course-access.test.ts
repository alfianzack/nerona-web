import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findUnique: vi.fn() },
  },
}));

import { hasEnrollment } from "@/lib/course-access";
import { prisma } from "@/lib/prisma";

describe("hasEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when an Enrollment row exists", async () => {
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "enrollment-1" });

    const result = await hasEnrollment("user-1", "course-1");

    expect(result).toBe(true);
    expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user-1", courseId: "course-1" } },
    });
  });

  it("returns false when no Enrollment row exists", async () => {
    (prisma.enrollment.findUnique as any).mockResolvedValue(null);

    const result = await hasEnrollment("user-1", "course-1");

    expect(result).toBe(false);
  });
});
