import { prisma } from "@/lib/prisma";
import { isExpired, monthlyExpiryFrom } from "@/lib/billing-period";
import { creditPlanPoints } from "@/lib/plan-points";

export type AgentAdminResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "profile_not_found" };

export const AGENT_PLANS = ["free", "pro", "business"] as const;
export type AgentPlan = (typeof AGENT_PLANS)[number];

export function isAgentPlan(value: string): value is AgentPlan {
  return (AGENT_PLANS as readonly string[]).includes(value);
}

export const PAID_AGENT_PLANS = ["pro", "business"] as const;

export function isAgentPlanExpired(
  profile: { plan: string; planExpiresAt: Date | null },
  now: Date = new Date()
): boolean {
  return (PAID_AGENT_PLANS as readonly string[]).includes(profile.plan) && isExpired(profile.planExpiresAt, now);
}

export async function activateAgentProfile(
  userEmail: string,
  plan?: AgentPlan
): Promise<AgentAdminResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const paid = plan ? (PAID_AGENT_PLANS as readonly string[]).includes(plan) : false;
  const expiryData =
    plan === undefined ? {} : { planExpiresAt: paid ? monthlyExpiryFrom(new Date()) : null };

  await prisma.agentProfile.upsert({
    where: { userId: user.id },
    update: { status: "active", ...(plan ? { plan } : {}), ...expiryData },
    create: { userId: user.id, status: "active", ...(plan ? { plan } : {}), ...expiryData },
  });

  // Same reasoning as the metadata grant: an active plan with an empty wallet
  // makes the agent answer "poin habis" to the tenant's first message. Only
  // credit when a plan was actually named — a bare reactivation keeps whatever
  // plan the profile already had, and that allowance was granted back then.
  if (plan) {
    await creditPlanPoints({
      userId: user.id,
      product: "agent",
      plan,
      createdById: null,
    });
  }

  return { ok: true };
}

export async function disableAgentProfile(userEmail: string): Promise<AgentAdminResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const profile = await prisma.agentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return { ok: false, reason: "profile_not_found" };
  }

  await prisma.agentProfile.update({ where: { id: profile.id }, data: { status: "disabled" } });
  return { ok: true };
}
