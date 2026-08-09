import { prisma } from "./prisma";
import { generateLicenseKey } from "./license";
import { activationExpiryFrom } from "@/lib/billing-period";
import { creditPlanPoints } from "@/lib/plan-points";
import { revokeHubTokens } from "@/lib/device-pairing";

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
  /**
   * Lisensi tanpa tanggal akhir — yang dibeli di alur sekali bayar.
   *
   * Bendera tersendiri, BUKAN `validUntil: undefined`. Di bawah, `undefined`
   * sudah jatuh ke `activationExpiryFrom(...)`, dan menyalahartikan "tidak
   * disebut" sebagai "tanpa batas" akan membuat setiap pemberian manual admin
   * ikut jadi permanen tanpa satu pun yang memintanya.
   *
   * `durationMonths` tetap berlaku dan tetap menentukan kelipatan poin: yang
   * permanen adalah aksesnya, bukan jatah poinnya.
   */
  permanen?: boolean;
  /** Only changes the ledger note ("Perpanjangan" vs "Bonus"). */
  isRenewal?: boolean;
}

export type GrantLicenseResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "plan_not_found" };

/**
 * `adminId` boleh `null`: pembayaran lewat payment gateway tidak punya admin,
 * dan `License.grantedById` memang nullable. `null` berarti persis yang
 * sebenarnya terjadi — tidak ada manusia yang melakukannya. Memakai id
 * pelanggan sendiri sebagai aktor akan menulis jejak audit yang berbohong
 * ("pengguna ini memberi lisensi kepada dirinya sendiri"), dan jejak yang
 * berbohong lebih buruk daripada jejak yang kosong.
 */
export async function grantLicense(
  adminId: string | null,
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
        hub: plan.hub,
        validUntil: options.permanen
          ? null
          : (options.validUntil ?? activationExpiryFrom(new Date(), months)),
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
        hub: plan.hub,
        validUntil: options.permanen
          ? null
          : (options.validUntil ?? activationExpiryFrom(new Date(), months)),
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

  // Turun paket mencabut Hub SEKETIKA, bukan menunggu lisensinya habis.
  //
  // Sengaja menilai keadaan AKHIR, bukan membandingkan paket lama dengan paket
  // baru. Itu membuatnya idempoten dan ikut menutup jalur yang tidak terpikir:
  // Business kedaluwarsa lalu diberikan ulang sebagai Pro, atau lisensi
  // dipindah paket dua kali berturut-turut. Naik ke Business tidak mencabut
  // apa pun karena `plan.hub` bernilai true di situ.
  if (!plan.hub) {
    await revokeHubTokens(user.id);
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
