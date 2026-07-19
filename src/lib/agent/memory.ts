import { prisma } from "@/lib/prisma";

export async function listRecentFacts(profileId: string, limit = 200): Promise<string[]> {
  const rows = await prisma.agentMemory.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { fact: true },
  });
  return rows.map((row) => row.fact);
}
