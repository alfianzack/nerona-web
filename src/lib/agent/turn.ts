import { getRecentHistory, logOutbound, type AgentChannel } from "./messages";
import { listRecentFacts } from "./memory";
import { buildSystemPrompt, toClaudeHistory } from "./context";
import { generateReply } from "./claude-client";
import { checkAgentGates, type AgentBlockReason } from "./gates";
import { spendPoints } from "@/lib/points";
import { costForUsage } from "./pricing";

export interface AgentTurnProfile {
  id: string;
  userId: string;
  plan: string;
  planExpiresAt: Date | null;
  businessName: string | null;
  timezone: string;
  whatsappPhone?: string | null;
}

export type AgentTurnResult =
  | { ok: true; reply: string; pointsBalance: number | null }
  | { ok: false; blocked: AgentBlockReason; reply: string };

/**
 * One agent turn, independent of how the message arrived.
 *
 * Gates → generate → log the reply → meter the wallet. Logging the INBOUND message
 * stays with each channel: WhatsApp records it in the webhook (it owns the
 * waMessageId used for de-duplication) before a job is ever created.
 */
export async function runAgentTurn(params: {
  profile: AgentTurnProfile;
  channel: AgentChannel;
}): Promise<AgentTurnResult> {
  const { profile, channel } = params;
  const phone = channel === "whatsapp" ? profile.whatsappPhone ?? null : null;

  const gate = await checkAgentGates(profile);
  if (gate) {
    await logOutbound({ profileId: profile.id, phone, body: gate.message, channel });
    return { ok: false, blocked: gate.blocked, reply: gate.message };
  }

  const [facts, history] = await Promise.all([
    listRecentFacts(profile.id),
    getRecentHistory(profile.id, 20),
  ]);

  const result = await generateReply({
    systemPrompt: buildSystemPrompt({
      businessName: profile.businessName,
      timezone: profile.timezone,
      facts,
    }),
    history: toClaudeHistory(history),
  });

  await logOutbound({ profileId: profile.id, phone, body: result.text, channel });

  // Best-effort: a metering failure must never undo a reply the tenant already has.
  let pointsBalance: number | null = null;
  try {
    pointsBalance = await spendPoints({
      userId: profile.userId,
      cost: costForUsage({ model: result.model, usage: result.usage }),
      note: `AI reply · ${channel} · ${result.model} · ${result.usage?.promptTokens ?? 0}+${result.usage?.completionTokens ?? 0} tok`,
    });
  } catch (err) {
    console.error("[agent-turn] spendPoints failed", err);
  }

  return { ok: true, reply: result.text, pointsBalance };
}
