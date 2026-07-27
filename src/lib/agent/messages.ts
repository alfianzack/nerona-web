import { prisma } from "@/lib/prisma";

export interface HistoryEntry {
  direction: "in" | "out";
  body: string;
}

export async function isDuplicateMessage(waMessageId: string): Promise<boolean> {
  const existing = await prisma.agentMessage.findUnique({ where: { waMessageId } });
  return existing !== null;
}

/** Where a message came from. Web chat has no phone number attached. */
export type AgentChannel = "whatsapp" | "web";

export async function logInbound(params: {
  profileId: string | null;
  waMessageId?: string | null;
  phone?: string | null;
  body: string;
  channel?: AgentChannel;
}): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      profileId: params.profileId,
      waMessageId: params.waMessageId ?? null,
      phone: params.phone ?? null,
      channel: params.channel ?? "whatsapp",
      direction: "in",
      body: params.body,
    },
  });
}

export async function logOutbound(params: {
  profileId: string | null;
  phone?: string | null;
  body: string;
  channel?: AgentChannel;
}): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      profileId: params.profileId,
      phone: params.phone ?? null,
      channel: params.channel ?? "whatsapp",
      direction: "out",
      body: params.body,
    },
  });
}

export interface ChatHistoryEntry {
  direction: "in" | "out";
  body: string;
  channel: string;
  createdAt: Date;
}

/**
 * History for display in the web chat. Separate from getRecentHistory, which
 * deliberately selects only what the model needs.
 */
export async function listChatHistory(
  profileId: string,
  limit = 50
): Promise<ChatHistoryEntry[]> {
  const rows = await prisma.agentMessage.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { direction: true, body: true, channel: true, createdAt: true },
  });
  return rows.reverse().map((row) => ({
    direction: row.direction as "in" | "out",
    body: row.body,
    channel: row.channel,
    createdAt: row.createdAt,
  }));
}

export async function getRecentHistory(
  profileId: string,
  limit = 20
): Promise<HistoryEntry[]> {
  const rows = await prisma.agentMessage.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { direction: true, body: true },
  });
  return rows
    .reverse()
    .map((row) => ({ direction: row.direction as "in" | "out", body: row.body }));
}
