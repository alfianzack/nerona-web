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

export async function adjustPoints(params: {
  userId: string;
  delta: number;
  note?: string;
  createdById: string;
}): Promise<AdjustResult> {
  const current = await getBalance(params.userId);
  if (current + params.delta < 0) {
    return { ok: false, reason: "below_zero" };
  }
  await prisma.pointTransaction.create({
    data: {
      userId: params.userId,
      delta: params.delta,
      reason: "manual_adjust",
      note: params.note ?? null,
      createdById: params.createdById,
    },
  });
  return { ok: true, balance: current + params.delta };
}

export async function spendPoints(params: {
  userId: string;
  cost: number;
  note?: string;
}): Promise<number> {
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
