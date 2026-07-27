import { prisma } from "@/lib/prisma";

/**
 * Points granted when an agent plan is activated or renewed.
 *
 * Sized to cover each plan's monthly message cap in `limits.ts` (free 50,
 * pro 500) at roughly 21 points per reply, so a tenant never hits an empty
 * wallet while their message quota still says they have room. Business has no
 * message cap, so its allowance is a deliberate ceiling (~1,400 replies) that
 * still meters runaway use.
 *
 * Both gates remain independent by design: a tenant must be under the message
 * cap AND hold points.
 */
export const AGENT_PLAN_POINTS: Record<string, number> = {
  free: 1_000,
  pro: 11_000,
  business: 30_000,
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

/** 0 for an unknown plan — never guess an allowance. */
export function pointsForAgentPlan(plan: string): number {
  return AGENT_PLAN_POINTS[plan] ?? 0;
}

/**
 * Credits a plan's allowance to the tenant's wallet. Additive on purpose: the
 * ledger is append-only, unused points carry over, and points the tenant bought
 * separately are never destroyed.
 *
 * Returns the amount credited (0 when the plan has no allowance).
 */
export async function creditAgentPlanPoints(params: {
  userId: string;
  plan: string;
  createdById?: string | null;
  isRenewal?: boolean;
}): Promise<number> {
  const amount = pointsForAgentPlan(params.plan);
  if (amount <= 0) return 0;

  const label = PLAN_LABELS[params.plan] ?? params.plan;
  await prisma.pointTransaction.create({
    data: {
      userId: params.userId,
      delta: amount,
      reason: "plan_grant",
      note: `${params.isRenewal ? "Perpanjangan" : "Bonus"} paket ${label}`,
      createdById: params.createdById ?? null,
    },
  });

  return amount;
}
