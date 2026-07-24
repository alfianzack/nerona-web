import { prisma } from "./prisma";
import { generateLicenseKey } from "./license";
import { monthlyExpiryFrom } from "@/lib/billing-period";

export interface GrantOptions {
  note?: string;
  amount?: number;
  currency?: string;
  validUntil?: Date;
}

export type GrantLicenseResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "plan_not_found" };

export async function grantLicense(
  adminId: string,
  userEmail: string,
  planId: string,
  options: GrantOptions = {}
): Promise<GrantLicenseResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return { ok: false, reason: "plan_not_found" };
  }

  const existingLicense = await prisma.license.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (existingLicense) {
    await prisma.license.update({
      where: { id: existingLicense.id },
      data: {
        status: "active",
        source: "manual_grant",
        grantedById: adminId,
        notes: options.note,
        planId: plan.id,
        marketplaces: plan.marketplaces,
        rejectAnalyzer: plan.rejectAnalyzer,
        validUntil: options.validUntil ?? monthlyExpiryFrom(new Date()),
      },
    });
  } else {
    const licenseKey = await generateLicenseKey();
    await prisma.license.create({
      data: {
        userId: user.id,
        licenseKey,
        status: "active",
        source: "manual_grant",
        grantedById: adminId,
        notes: options.note,
        planId: plan.id,
        marketplaces: plan.marketplaces,
        rejectAnalyzer: plan.rejectAnalyzer,
        validUntil: options.validUntil ?? monthlyExpiryFrom(new Date()),
      },
    });
  }

  if (options.amount) {
    await prisma.order.create({
      data: {
        userId: user.id,
        amount: options.amount,
        currency: options.currency ?? "idr",
        note: options.note,
      },
    });
  }

  return { ok: true };
}

export type RevokeLicenseResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "license_not_found" };

export async function revokeLicense(userEmail: string): Promise<RevokeLicenseResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const license = await prisma.license.findFirst({ where: { userId: user.id } });
  if (!license) {
    return { ok: false, reason: "license_not_found" };
  }

  await prisma.license.update({ where: { id: license.id }, data: { status: "revoked" } });
  return { ok: true };
}

export type GrantEnrollmentResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "course_not_found" };

export async function grantEnrollment(
  adminId: string,
  userEmail: string,
  courseId: string,
  options: GrantOptions = {}
): Promise<GrantEnrollmentResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return { ok: false, reason: "course_not_found" };
  }

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    update: { source: "manual_grant" },
    create: { userId: user.id, courseId, source: "manual_grant" },
  });

  if (options.amount) {
    await prisma.order.create({
      data: {
        userId: user.id,
        courseId,
        amount: options.amount,
        currency: options.currency ?? "idr",
        note: options.note,
      },
    });
  }

  return { ok: true };
}

export type RevokeEnrollmentResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "enrollment_not_found" };

export async function revokeEnrollment(
  userEmail: string,
  courseId: string
): Promise<RevokeEnrollmentResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (!existing) {
    return { ok: false, reason: "enrollment_not_found" };
  }

  await prisma.enrollment.delete({ where: { id: existing.id } });
  return { ok: true };
}
