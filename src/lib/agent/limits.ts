import { prisma } from "@/lib/prisma";

// Inbound messages the agent will process per calendar month, by
// AgentProfile.plan. null = unlimited. Unknown plan values fall back to the
// free limit so a bad value can never mean unlimited usage.
export const AGENT_PLAN_LIMITS: Record<string, number | null> = {
  free: 50,
  pro: 500,
  business: null,
};

export function monthlyLimitFor(plan: string): number | null {
  return plan in AGENT_PLAN_LIMITS ? AGENT_PLAN_LIMITS[plan] : AGENT_PLAN_LIMITS.free;
}

// True when the profile's processed inbound messages this calendar month
// already exceed the plan's limit. Called after the current message has been
// logged, so `count > limit` lets exactly `limit` messages through.
export async function hasExceededMonthlyLimit(
  profileId: string,
  plan: string,
  now: Date = new Date()
): Promise<boolean> {
  const limit = monthlyLimitFor(plan);
  if (limit === null) {
    return false;
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const count = await prisma.agentMessage.count({
    where: { profileId, direction: "in", createdAt: { gte: monthStart } },
  });
  return count > limit;
}
