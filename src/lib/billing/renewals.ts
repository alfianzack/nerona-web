import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_PLANS = ["pro", "business"];

function title(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

async function hasPending(userId: string, product: "agent" | "metadata"): Promise<boolean> {
  const n = await prisma.orderRequest.count({ where: { userId, product, status: "pending" } });
  return n > 0;
}

// Auto-create pending renewal OrderRequests for subscriptions expiring within
// `leadDays` (or already lapsed). Idempotent: skips users who already have a
// pending request for that product. `planExpiresAt/validUntil: { lte }` excludes
// nulls, so free/never-expiring rows are ignored.
export async function generateDueRenewals(
  now: Date = new Date(),
  leadDays = 3
): Promise<{ created: number }> {
  const cutoff = new Date(now.getTime() + leadDays * DAY_MS);
  let created = 0;

  const profiles = await prisma.agentProfile.findMany({
    where: { status: "active", plan: { in: PAID_PLANS }, planExpiresAt: { lte: cutoff } },
    select: { userId: true, plan: true },
  });
  for (const p of profiles) {
    if (await hasPending(p.userId, "agent")) continue;
    await prisma.orderRequest.create({
      data: { userId: p.userId, product: "agent", planName: title(p.plan), isRenewal: true },
    });
    created++;
  }

  const licenses = await prisma.license.findMany({
    where: { status: { in: ["active", "comp"] }, validUntil: { lte: cutoff } },
    select: { userId: true, plan: { select: { name: true } } },
  });
  for (const l of licenses) {
    if (!l.plan?.name) continue;
    if (await hasPending(l.userId, "metadata")) continue;
    await prisma.orderRequest.create({
      data: { userId: l.userId, product: "metadata", planName: l.plan.name, isRenewal: true },
    });
    created++;
  }

  return { created };
}
