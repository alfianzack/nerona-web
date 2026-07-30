import { prisma } from "./prisma";
import { generateLicenseKey } from "./license";
import { activationExpiryFrom } from "@/lib/billing-period";
import { creditPlanPoints } from "@/lib/plan-points";

export interface GrantOptions {
  note?: string;
  amount?: number;
  currency?: string;
  validUntil?: Date;
  /**
   * Durasi yang dibeli. Menentukan masa aktif dan kelipatan poin, lalu disimpan
   * di lisensi supaya cron perpanjangan memperpanjang selama itu lagi.
   * Pemberian manual admin tanpa nilai ini tetap 1 bulan.
   */
  durationMonths?: number;
  /** Only changes the ledger note ("Perpanjangan" vs "Bonus"). */
  isRenewal?: boolean;
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

  const months = Math.max(1, Math.floor(options.durationMonths ?? 1));
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
        validUntil: options.validUntil ?? activationExpiryFrom(new Date(), months),
        durationMonths: months,
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
        validUntil: options.validUntil ?? activationExpiryFrom(new Date(), months),
        durationMonths: months,
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

  // A metadata license without points is useless: api/extension/generate spends
  // points on every call, so activating a plan and granting no allowance leaves
  // the tenant unable to use what they just paid for. Both metadata activation
  // paths — order fulfilment and the manual admin grant — land here, which is
  // why fulfillOrderRequest's metadata branch deliberately does not credit.
  await creditPlanPoints({
    userId: user.id,
    product: "metadata",
    plan: plan.name,
    durationMonths: months,
    createdById: adminId,
    isRenewal: Boolean(options.isRenewal),
  });

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
