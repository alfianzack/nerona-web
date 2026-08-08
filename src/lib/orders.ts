import { prisma } from "./prisma";
import { generateLicenseKey } from "./license";
import { grantLicense } from "./admin-grants";
import { activationExpiryFrom, renewedExpiryFrom } from "@/lib/billing-period";
import { coerceDuration } from "@/lib/plan-duration";
import { creditPlanPoints, hasEverReceivedPlanGrant } from "@/lib/plan-points";
import { creditTopupPoints } from "@/lib/points";
import { getTopupPackages, topupLabel } from "@/lib/topup";
import { AGENT_ENABLED } from "@/lib/features";

export type Product = "metadata" | "agent";

export const FREE_PLAN_NAME = "Free";
export const PAID_PLAN_NAMES = ["Pro", "Business"] as const;

function isProduct(value: string): value is Product {
  return value === "metadata" || value === "agent";
}

function isKnownPlan(planName: string): boolean {
  return planName === FREE_PLAN_NAME || PAID_PLAN_NAMES.includes(planName as never);
}

export type SubmitTopupResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: "unknown_package"; }
  | { ok: false; reason: "already_pending"; orderId: string };

/**
 * Order pembelian poin satuan.
 *
 * Jumlah poin diambil dari daftar paket di server, bukan dari yang dikirim
 * client: satu-satunya yang datang dari browser adalah *jumlah poin mana* yang
 * dipilih, dan harganya dicari sendiri. Tanpa itu, client bisa mengirim
 * "5000 poin seharga 1 rupiah".
 */
export async function submitTopupOrder(
  userId: string,
  points: unknown
): Promise<SubmitTopupResult> {
  const packages = await getTopupPackages();
  const chosen = packages.find((p) => p.points === Number(points));
  if (!chosen) {
    return { ok: false, reason: "unknown_package" };
  }

  // Satu top-up tertunda pada satu waktu, sama seperti order paket: dua order
  // menunggu transfer sekaligus membuat admin tidak tahu bukti mana milik mana.
  const pending = await prisma.orderRequest.findFirst({
    where: { userId, product: "points", status: "pending" },
  });
  if (pending) {
    return { ok: false, reason: "already_pending", orderId: pending.id };
  }

  const created = await prisma.orderRequest.create({
    data: {
      userId,
      product: "points",
      planName: topupLabel(chosen.points),
      pointsAmount: chosen.points,
      priceAmount: chosen.price,
    },
  });
  return { ok: true, orderId: created.id };
}

export type SubmitOrderResult =
  | { ok: true; kind: "free_activated" }
  | { ok: true; kind: "request_created"; orderId: string }
  | { ok: false; reason: "already_pending"; orderId: string }
  | {
      ok: false;
      reason: "invalid_product" | "invalid_plan" | "plan_not_found" | "account_disabled";
    };

async function activateFreeMetadata(userId: string): Promise<SubmitOrderResult> {
  const freePlan = await prisma.plan.findFirst({ where: { name: FREE_PLAN_NAME } });
  if (!freePlan) {
    return { ok: false, reason: "plan_not_found" };
  }

  const existing = await prisma.license.findFirst({ where: { userId } });
  if (existing?.status === "active") {
    // Already has access at Free tier or better — never downgrade from here.
    return { ok: true, kind: "free_activated" };
  }

  const data = {
    status: "active",
    source: "free_signup",
    planId: freePlan.id,
    marketplaces: freePlan.marketplaces,
    rejectAnalyzer: freePlan.rejectAnalyzer,
    hub: freePlan.hub,
  };
  if (existing) {
    await prisma.license.update({ where: { id: existing.id }, data });
  } else {
    await prisma.license.create({
      data: { ...data, userId, licenseKey: await generateLicenseKey() },
    });
  }

  // This path writes the license directly rather than through grantLicense, so
  // it never picked up the crediting added there — a Free metadata user had an
  // active license and an empty wallet while api/extension/generate charges per
  // call. The trial is LIFETIME, so the ledger decides: the early return above
  // stops a repeat submit, but only this stops revoke-then-reactivate.
  if (!(await hasEverReceivedPlanGrant(userId, "metadata"))) {
    await creditPlanPoints({ userId, product: "metadata", plan: "free" });
  }

  return { ok: true, kind: "free_activated" };
}

async function activateFreeAgent(userId: string): Promise<SubmitOrderResult> {
  const profile = await prisma.agentProfile.findUnique({ where: { userId } });
  if (profile?.status === "disabled") {
    return { ok: false, reason: "account_disabled" };
  }
  if (profile?.status === "active") {
    return { ok: true, kind: "free_activated" };
  }
  if (profile) {
    await prisma.agentProfile.update({
      where: { id: profile.id },
      data: { status: "active", plan: "free", planExpiresAt: null },
    });
  } else {
    await prisma.agentProfile.create({
      data: { userId, status: "active", plan: "free", planExpiresAt: null },
    });
  }
  // The trial is LIFETIME. The early return above stops a repeat submit, but a
  // disabled-then-reactivated profile would fall through to here and collect a
  // second allowance, so the ledger is what decides "ever".
  if (!(await hasEverReceivedPlanGrant(userId, "agent"))) {
    await creditPlanPoints({ userId, product: "agent", plan: "free" });
  }
  return { ok: true, kind: "free_activated" };
}

export async function submitOrder(
  userId: string,
  product: string,
  planName: string,
  contactNote?: string,
  durationMonths?: unknown
): Promise<SubmitOrderResult> {
  if (!isProduct(product)) {
    return { ok: false, reason: "invalid_product" };
  }
  // Agent sedang disembunyikan, jadi order baru untuknya ditolak — termasuk
  // aktivasi Free, yang di bawah ini melompat langsung ke activateFreeAgent.
  //
  // Cek terpisah, bukan dijadikan bagian isProduct: isProduct adalah type
  // guard (`value is Product`), dan membuatnya menjawab "false" untuk sebuah
  // Product yang sah akan membuat tipenya berbohong.
  //
  // Jalur PEMENUHAN order tidak disentuh: order agent yang sudah masuk harus
  // tetap bisa diverifikasi admin, kalau tidak uang pelanggan tersangkut di
  // order pending.
  if (product === "agent" && !AGENT_ENABLED) {
    return { ok: false, reason: "invalid_product" };
  }
  if (!isKnownPlan(planName)) {
    return { ok: false, reason: "invalid_plan" };
  }

  if (planName === FREE_PLAN_NAME) {
    return product === "metadata" ? activateFreeMetadata(userId) : activateFreeAgent(userId);
  }

  if (product === "metadata") {
    const plan = await prisma.plan.findFirst({ where: { name: planName } });
    if (!plan) {
      return { ok: false, reason: "plan_not_found" };
    }
  }

  const pending = await prisma.orderRequest.findFirst({
    where: { userId, product, status: "pending" },
  });
  if (pending) {
    return { ok: false, reason: "already_pending", orderId: pending.id };
  }

  const created = await prisma.orderRequest.create({
    data: {
      userId,
      product,
      planName,
      // Durasi datang dari client; coerceDuration menolak apa pun di luar
      // 1/3/6/12 dengan mengembalikannya ke bulanan, bukan menyimpan angka liar
      // yang nanti dipakai menghitung masa aktif.
      durationMonths: coerceDuration(durationMonths),
      contactNote: contactNote || undefined,
    },
  });
  return { ok: true, kind: "request_created", orderId: created.id };
}

const ORDER_LIST_SELECT = {
  id: true,
  product: true,
  planName: true,
  durationMonths: true,
  pointsAmount: true,
  priceAmount: true,
  isRenewal: true,
  contactNote: true,
  status: true,
  createdAt: true,
  proofUploadedAt: true,
} as const;

export async function listUserOrders(userId: string) {
  return prisma.orderRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: ORDER_LIST_SELECT,
  });
}

export async function getUserOrder(userId: string, orderId: string) {
  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
    select: { ...ORDER_LIST_SELECT, userId: true },
  });
  if (!order || order.userId !== userId) return null;
  return order;
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Detect the real image type from the file's magic bytes, ignoring the
 * client-supplied Content-Type (which is trivially spoofable). Returns the
 * canonical MIME or null if the content is not an allowed image.
 */
export function sniffImageMime(bytes: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export type AttachProofResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_pending" | "invalid_type" | "too_large" };

export async function attachPaymentProof(
  userId: string,
  orderId: string,
  bytes: Buffer,
  mime: string
): Promise<AttachProofResult> {
  if (bytes.length > MAX_PROOF_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  // Trust the content, not the client's claimed Content-Type. The stored MIME is
  // the sniffed one, so it is always a safe, known image type when served back.
  const detected = sniffImageMime(bytes);
  if (!detected) {
    return { ok: false, reason: "invalid_type" };
  }
  mime = detected;

  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
    select: { userId: true, status: true },
  });
  if (!order || order.userId !== userId) {
    return { ok: false, reason: "not_found" };
  }
  if (order.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }

  await prisma.orderRequest.update({
    where: { id: orderId },
    data: { proofImage: bytes, proofMime: mime, proofUploadedAt: new Date() },
  });
  return { ok: true };
}

// Returns the proof image if it exists and the requester (owner or any admin)
// is allowed to see it.
export async function getProofImage(
  orderId: string,
  requesterId: string,
  isAdmin: boolean
): Promise<{ bytes: Buffer; mime: string } | null> {
  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
    select: { userId: true, proofImage: true, proofMime: true },
  });
  if (!order || !order.proofImage || !order.proofMime) return null;
  if (!isAdmin && order.userId !== requesterId) return null;
  return { bytes: Buffer.from(order.proofImage), mime: order.proofMime };
}

export type FulfillOrderResult =
  | { ok: true }
  | {
      ok: false;
      reason: "order_not_found" | "not_pending" | "plan_not_found" | "grant_failed" | "invalid_topup";
    };

/**
 * Satu-satunya jalan sebuah order berubah jadi paket aktif atau poin.
 *
 * `adminId` `null` berarti pembayaran gateway yang memenuhinya, bukan manusia.
 * Webhook memanggil fungsi yang sama persis dengan tombol konfirmasi admin —
 * itu yang membuat tidak ada jalur aktivasi kedua yang harus dijaga ikut benar.
 */
export async function fulfillOrderRequest(
  adminId: string | null,
  orderId: string
): Promise<FulfillOrderResult> {
  const order = await prisma.orderRequest.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true, id: true } } },
  });
  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }
  if (order.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }

  if (order.product === "points") {
    // pointsAmount ditulis saat order dibuat dari daftar paket server. Kalau
    // hilang, ada yang salah di data — mengarang jumlahnya di sini berarti
    // memberi poin yang tidak pernah dibayar.
    if (!order.pointsAmount || order.pointsAmount <= 0) {
      return { ok: false, reason: "invalid_topup" };
    }
    await creditTopupPoints({
      userId: order.user.id,
      points: order.pointsAmount,
      note: `Top-up ${topupLabel(order.pointsAmount)} · Order ${order.id}`,
      createdById: adminId,
    });
  } else if (order.product === "metadata") {
    const plan = await prisma.plan.findFirst({ where: { name: order.planName } });
    if (!plan) {
      return { ok: false, reason: "plan_not_found" };
    }
    const months = coerceDuration(order.durationMonths);
    let validUntil: Date | undefined;
    if (order.isRenewal) {
      const current = await prisma.license.findFirst({
        where: { userId: order.user.id, status: { in: ["active", "comp"] } },
        orderBy: { createdAt: "desc" },
        select: { validUntil: true },
      });
      validUntil = renewedExpiryFrom(current?.validUntil ?? null, new Date(), months);
    }
    // grantLicense credits the metadata allowance, so this branch must not —
    // a second call here would double every metadata activation.
    const result = await grantLicense(adminId, order.user.email, plan.id, {
      note: `Order ${order.id}`,
      validUntil,
      durationMonths: months,
      isRenewal: Boolean(order.isRenewal),
    });
    if (!result.ok) {
      return { ok: false, reason: "grant_failed" };
    }
  } else {
    const plan = order.planName.toLowerCase();
    const now = new Date();
    const months = coerceDuration(order.durationMonths);
    let expiresAt: Date;
    if (order.isRenewal) {
      const current = await prisma.agentProfile.findUnique({
        where: { userId: order.user.id },
        select: { planExpiresAt: true },
      });
      expiresAt = renewedExpiryFrom(current?.planExpiresAt ?? null, now, months);
    } else {
      expiresAt = activationExpiryFrom(now, months);
    }
    await prisma.agentProfile.upsert({
      where: { userId: order.user.id },
      update: { status: "active", plan, planExpiresAt: expiresAt, planDurationMonths: months },
      create: {
        userId: order.user.id,
        status: "active",
        plan,
        planExpiresAt: expiresAt,
        planDurationMonths: months,
      },
    });
    // Without this the tenant has an active plan and an empty wallet, so the
    // agent answers "poin habis" to their very first message.
    await creditPlanPoints({
      userId: order.user.id,
      product: "agent",
      plan,
      durationMonths: months,
      createdById: adminId,
      isRenewal: Boolean(order.isRenewal),
    });
  }

  await prisma.orderRequest.update({
    where: { id: order.id },
    data: { status: "fulfilled", fulfilledAt: new Date(), fulfilledById: adminId },
  });
  return { ok: true };
}

export type CancelOrderResult = { ok: true } | { ok: false; reason: "order_not_found" | "not_pending" };

export async function cancelOrderRequest(orderId: string): Promise<CancelOrderResult> {
  const order = await prisma.orderRequest.findUnique({ where: { id: orderId } });
  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }
  if (order.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }
  await prisma.orderRequest.update({ where: { id: orderId }, data: { status: "cancelled" } });
  return { ok: true };
}

export async function listPendingRenewals(userId: string) {
  return prisma.orderRequest.findMany({
    where: {
      userId,
      status: "pending",
      isRenewal: true,
      // Tagihan perpanjangan Agent tidak ditampilkan selama produknya
      // disembunyikan — memintanya membayar sesuatu yang tidak bisa dia lihat
      // di mana pun lebih buruk daripada tidak menagih.
      ...(AGENT_ENABLED ? {} : { product: "metadata" }),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, product: true, planName: true, proofUploadedAt: true },
  });
}

export async function listPendingOrderRequests() {
  return prisma.orderRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    // Explicit select so the heavy proofImage blob is never loaded for the list.
    select: {
      id: true,
      product: true,
      planName: true,
      durationMonths: true,
      pointsAmount: true,
      priceAmount: true,
      contactNote: true,
      createdAt: true,
      proofUploadedAt: true,
      isRenewal: true,
      user: { select: { email: true, name: true } },
    },
  });
}
