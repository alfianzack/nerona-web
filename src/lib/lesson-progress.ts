import { prisma } from "./prisma";
import { hasEnrollment } from "./course-access";

export type MarkLessonCompleteResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_enrolled" };

export async function markLessonComplete(
  userId: string,
  lessonId: string
): Promise<MarkLessonCompleteResult> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: true },
  });
  if (!lesson) {
    return { ok: false, reason: "not_found" };
  }

  const enrolled = await hasEnrollment(userId, lesson.module.courseId);
  if (!enrolled) {
    return { ok: false, reason: "not_enrolled" };
  }

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: {},
    create: { userId, lessonId },
  });

  return { ok: true };
}
