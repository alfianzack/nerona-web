import { baseUrl } from "@/lib/base-url";
import { isAgentPlanExpired } from "./admin";
import { hasExceededMonthlyLimit } from "./limits";
import { getBalance } from "@/lib/points";

/**
 * Reasons the agent will refuse to answer a message. These are not errors — each
 * one has a reply the tenant should see, exactly as the WhatsApp path has always
 * sent it.
 */
export type AgentBlockReason = "plan_expired" | "quota" | "no_points";

export interface AgentBlock {
  blocked: AgentBlockReason;
  message: string;
}

export const AGENT_BLOCK_MESSAGES: Record<AgentBlockReason, () => string> = {
  plan_expired: () =>
    `Paket Anda sudah berakhir. Silakan perpanjang di ${baseUrl()}/agent untuk melanjutkan.`,
  quota: () =>
    `Kuota pesan bulanan paket Anda sudah habis. Upgrade paket di ${baseUrl()}/agent untuk melanjutkan.`,
  no_points: () =>
    "Maaf, poin kamu sudah habis. Silakan isi ulang poin untuk melanjutkan pakai asisten AI.",
};

function block(reason: AgentBlockReason): AgentBlock {
  return { blocked: reason, message: AGENT_BLOCK_MESSAGES[reason]() };
}

/**
 * The channel-agnostic gates every agent turn must pass. Shared so a new channel
 * cannot accidentally skip one. Checks stop at the first failure, cheapest first.
 */
export async function checkAgentGates(profile: {
  id: string;
  userId: string;
  plan: string;
  planExpiresAt: Date | null;
}): Promise<AgentBlock | null> {
  if (isAgentPlanExpired(profile)) return block("plan_expired");
  if (await hasExceededMonthlyLimit(profile.id, profile.plan)) return block("quota");
  if ((await getBalance(profile.userId)) <= 0) return block("no_points");
  return null;
}
