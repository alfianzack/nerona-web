import { prisma } from "./prisma";

export async function hasEnrollment(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return enrollment !== null;
}
