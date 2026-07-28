import { prisma } from "./prisma";
import { LOW_STOCK_THRESHOLD } from "./shop";

const REVENUE_STATUSES = ["paid", "done"];

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getDashboardSummary(userId: string, now: Date = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [revenueAgg, orderCount, activeProductCount, unpaidCount, recentOrders, topItems, lowStock] =
    await Promise.all([
      prisma.shopOrder.aggregate({
        _sum: { total: true },
        where: { userId, status: { in: REVENUE_STATUSES }, occurredAt: { gte: monthStart } },
      }),
      prisma.shopOrder.count({ where: { userId, occurredAt: { gte: monthStart } } }),
      prisma.shopProduct.count({ where: { userId, isActive: true } }),
      prisma.shopOrder.count({ where: { userId, status: "new" } }),
      prisma.shopOrder.findMany({
        where: { userId },
        orderBy: { occurredAt: "desc" },
        take: 8,
        select: { id: true, customerName: true, total: true, status: true, occurredAt: true },
      }),
      prisma.shopOrderItem.groupBy({
        by: ["productName"],
        where: { order: { userId, status: { in: REVENUE_STATUSES } } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 5,
      }),
      prisma.shopProduct.findMany({
        where: { userId, stock: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { stock: "asc" },
        take: 5,
        select: { id: true, name: true, stock: true },
      }),
    ]);

  return {
    revenueThisMonth: revenueAgg._sum.total ?? 0,
    orderCount,
    activeProductCount,
    unpaidCount,
    recentOrders,
    topProducts: topItems.map((t) => ({ productName: t.productName, qtySold: t._sum.qty ?? 0 })),
    lowStock,
  };
}

export interface SalesSummary {
  revenue: number;
  /** Hanya transaksi yang menghasilkan omzet (paid/done) — order dibatalkan tidak dihitung. */
  orderCount: number;
  topProducts: { productName: string; qtySold: number }[];
}

/**
 * Ringkasan penjualan untuk rentang tanggal bebas, difilter `occurredAt` (tanggal
 * transaksi menurut pemilik, bukan waktu pencatatan).
 *
 * Dipakai tool `get_sales_summary` milik agen, dan disiapkan untuk recap harian nanti.
 */
export async function getSalesSummaryForRange(
  userId: string,
  range: { from: Date; to: Date }
): Promise<SalesSummary> {
  const where = {
    userId,
    status: { in: REVENUE_STATUSES },
    occurredAt: { gte: range.from, lte: range.to },
  };

  const [revenueAgg, orderCount, topItems] = await Promise.all([
    prisma.shopOrder.aggregate({ _sum: { total: true }, where }),
    prisma.shopOrder.count({ where }),
    prisma.shopOrderItem.groupBy({
      by: ["productName"],
      where: { order: where },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    }),
  ]);

  return {
    revenue: revenueAgg._sum.total ?? 0,
    orderCount,
    topProducts: topItems.map((t) => ({ productName: t.productName, qtySold: t._sum.qty ?? 0 })),
  };
}

export async function getSalesSeries(userId: string, days = 30, now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const orders = await prisma.shopOrder.findMany({
    where: { userId, status: { in: REVENUE_STATUSES }, occurredAt: { gte: start } },
    select: { total: true, occurredAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    buckets.set(dateKey(d), 0);
  }
  for (const order of orders) {
    const key = dateKey(order.occurredAt);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + order.total);
    }
  }

  return Array.from(buckets.entries()).map(([date, revenue]) => ({ date, revenue }));
}
