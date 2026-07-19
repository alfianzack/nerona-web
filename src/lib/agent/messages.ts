import { prisma } from "@/lib/prisma";

export interface HistoryEntry {
  direction: "in" | "out";
  body: string;
}

export async function isDuplicateMessage(waMessageId: string): Promise<boolean> {
  const existing = await prisma.agentMessage.findUnique({ where: { waMessageId } });
  return existing !== null;
}

export async function logInbound(params: {
  profileId: string | null;
  waMessageId: string;
  phone: string;
  body: string;
}): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      profileId: params.profileId,
      waMessageId: params.waMessageId,
      phone: params.phone,
      direction: "in",
      body: params.body,
    },
  });
}

export async function logOutbound(params: {
  profileId: string | null;
  phone: string;
  body: string;
}): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      profileId: params.profileId,
      phone: params.phone,
      direction: "out",
      body: params.body,
    },
  });
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
