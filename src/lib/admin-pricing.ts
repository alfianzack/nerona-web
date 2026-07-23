import { prisma } from "./prisma";

export type UpdatePriceResult = { ok: true } | { ok: false; reason: "not_found" };

// Empty string clears the price (stored as null, rendered as the
// "Hubungi kami" fallback).
function normalize(priceLabel: string): string | null {
  const trimmed = priceLabel.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updatePlanPrice(
  planId: string,
  priceLabel: string
): Promise<UpdatePriceResult> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return { ok: false, reason: "not_found" };
  }
  await prisma.plan.update({ where: { id: planId }, data: { priceLabel: normalize(priceLabel) } });
  return { ok: true };
}

export async function updateCoursePrice(
  courseId: string,
  priceLabel: string
): Promise<UpdatePriceResult> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return { ok: false, reason: "not_found" };
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { priceLabel: normalize(priceLabel) },
  });
  return { ok: true };
}
