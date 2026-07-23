import { prisma } from "@/lib/prisma";

export type AgentAdminResult =
  | { ok: true }
  | { ok: false; reason: "user_not_found" | "profile_not_found" };

export const AGENT_PLANS = ["free", "pro", "business"] as const;
export type AgentPlan = (typeof AGENT_PLANS)[number];

export function isAgentPlan(value: string): value is AgentPlan {
  return (AGENT_PLANS as readonly string[]).includes(value);
}

export async function activateAgentProfile(
  userEmail: string,
  plan?: AgentPlan
): Promise<AgentAdminResult> {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  await prisma.agentProfile.upsert({
    where: { userId: user.id },
    update: { status: "active", ...(plan ? { plan } : {}) },
    create: { userId: user.id, status: "active", ...(plan ? { plan } : {}) },
  });

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
