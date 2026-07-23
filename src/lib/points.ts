import { prisma } from "@/lib/prisma";

export interface PointTransactionView {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export async function getBalance(userId: string): Promise<number> {
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

export async function listTransactions(userId: string, take = 50): Promise<PointTransactionView[]> {
  const rows = await prisma.pointTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    note: r.note,
    createdByName: r.createdBy?.name ?? r.createdBy?.email ?? null,
    createdAt: r.createdAt,
  }));
}

export type AdjustResult = { ok: true; balance: number } | { ok: false; reason: "below_zero" };

async function runAdjustTransaction(params: {
  userId: string;
  delta: number;
  note?: string;
  createdById: string;
}): Promise<AdjustResult> {
  return prisma.$transaction(
    async (tx) => {
      const agg = await tx.pointTransaction.aggregate({
        where: { userId: params.userId },
        _sum: { delta: true },
      });
      const current = agg._sum.delta ?? 0;
      if (current + params.delta < 0) {
        return { ok: false, reason: "below_zero" } as const;
      }
      await tx.pointTransaction.create({
        data: {
          userId: params.userId,
          delta: params.delta,
          reason: "manual_adjust",
          note: params.note ?? null,
          createdById: params.createdById,
        },
      });
      return { ok: true, balance: current + params.delta } as const;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function adjustPoints(params: {
  userId: string;
  delta: number;
  note?: string;
  createdById: string;
}): Promise<AdjustResult> {
  try {
    return await runAdjustTransaction(params);
  } catch (err: any) {
    if (err?.code === "P2034") {
      // Serialization failure: retry once, then let a second failure propagate.
      return runAdjustTransaction(params);
    }
    throw err;
  }
}

export async function spendPoints(params: {
  userId: string;
  cost: number;
  note?: string;
}): Promise<number> {
  if (!Number.isInteger(params.cost) || params.cost <= 0) {
    throw new Error("spendPoints: cost must be a positive integer");
  }
  await prisma.pointTransaction.create({
    data: {
      userId: params.userId,
      delta: -Math.abs(params.cost),
      reason: "spend",
      note: params.note ?? null,
      createdById: null,
    },
  });
  return getBalance(params.userId);
}
