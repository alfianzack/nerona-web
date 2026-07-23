import { prisma } from "./prisma";
import { generateLicenseKey } from "./license";
import { grantLicense } from "./admin-grants";

export type Product = "metadata" | "agent";

export const FREE_PLAN_NAME = "Free";
export const PAID_PLAN_NAMES = ["Pro", "Business"] as const;

function isProduct(value: string): value is Product {
  return value === "metadata" || value === "agent";
}

function isKnownPlan(planName: string): boolean {
  return planName === FREE_PLAN_NAME || PAID_PLAN_NAMES.includes(planName as never);
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
  };
  if (existing) {
    await prisma.license.update({ where: { id: existing.id }, data });
  } else {
    await prisma.license.create({
      data: { ...data, userId, licenseKey: await generateLicenseKey() },
    });
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
      data: { status: "active", plan: "free" },
    });
  } else {
    await prisma.agentProfile.create({ data: { userId, status: "active", plan: "free" } });
  }
  return { ok: true, kind: "free_activated" };
}

export async function submitOrder(
  userId: string,
  product: string,
  planName: string,
  contactNote?: string
): Promise<SubmitOrderResult> {
  if (!isProduct(product)) {
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
    data: { userId, product, planName, contactNote: contactNote || undefined },
  });
  return { ok: true, kind: "request_created", orderId: created.id };
}

const ORDER_LIST_SELECT = {
  id: true,
  product: true,
  planName: true,
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
  | { ok: false; reason: "order_not_found" | "not_pending" | "plan_not_found" | "grant_failed" };

export async function fulfillOrderRequest(
  adminId: string,
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

  if (order.product === "metadata") {
    const plan = await prisma.plan.findFirst({ where: { name: order.planName } });
    if (!plan) {
      return { ok: false, reason: "plan_not_found" };
    }
    const result = await grantLicense(adminId, order.user.email, plan.id, {
      note: `Order ${order.id}`,
    });
    if (!result.ok) {
      return { ok: false, reason: "grant_failed" };
    }
  } else {
    const plan = order.planName.toLowerCase();
    await prisma.agentProfile.upsert({
      where: { userId: order.user.id },
      update: { status: "active", plan },
      create: { userId: order.user.id, status: "active", plan },
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

export async function listPendingOrderRequests() {
  return prisma.orderRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    // Explicit select so the heavy proofImage blob is never loaded for the list.
    select: {
      id: true,
      product: true,
      planName: true,
      contactNote: true,
      createdAt: true,
      proofUploadedAt: true,
      user: { select: { email: true, name: true } },
    },
  });
}
