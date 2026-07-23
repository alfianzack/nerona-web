import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lesson: { findUnique: vi.fn() },
    lessonProgress: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/course-access", () => ({ hasEnrollment: vi.fn() }));

import { markLessonComplete } from "@/lib/lesson-progress";
import { prisma } from "@/lib/prisma";
import { hasEnrollment } from "@/lib/course-access";

describe("markLessonComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when the lesson doesn't exist", async () => {
    (prisma.lesson.findUnique as any).mockResolvedValue(null);

    const result = await markLessonComplete("user-1", "lesson-1");

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(hasEnrollment).not.toHaveBeenCalled();
    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it("returns not_enrolled when the user has no Enrollment for the lesson's course", async () => {
    (prisma.lesson.findUnique as any).mockResolvedValue({
      id: "lesson-1",
      module: { courseId: "course-1" },
    });
    (hasEnrollment as any).mockResolvedValue(false);

    const result = await markLessonComplete("user-1", "lesson-1");

    expect(result).toEqual({ ok: false, reason: "not_enrolled" });
    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it("upserts LessonProgress when the user is enrolled", async () => {
    (prisma.lesson.findUnique as any).mockResolvedValue({
      id: "lesson-1",
      module: { courseId: "course-1" },
    });
    (hasEnrollment as any).mockResolvedValue(true);

    const result = await markLessonComplete("user-1", "lesson-1");

    expect(result).toEqual({ ok: true });
    expect(prisma.lessonProgress.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: "user-1", lessonId: "lesson-1" } },
      update: {},
      create: { userId: "user-1", lessonId: "lesson-1" },
    });
  });
});
