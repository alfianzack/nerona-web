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
  | { ok: true; kind: "request_created" }
  | {
      ok: false;
      reason: "invalid_product" | "invalid_plan" | "plan_not_found" | "already_pending" | "account_disabled";
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
    return { ok: false, reason: "already_pending" };
  }

  await prisma.orderRequest.create({
    data: { userId, product, planName, contactNote: contactNote || undefined },
  });
  return { ok: true, kind: "request_created" };
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
    include: { user: { select: { email: true, name: true } } },
  });
}
