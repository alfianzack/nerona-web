import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopOrder: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    shopProduct: { count: vi.fn(), findMany: vi.fn() },
    shopOrderItem: { groupBy: vi.fn() },
  },
}));

import { getDashboardSummary, getSalesSeries } from "@/lib/shop-dashboard";
import { prisma } from "@/lib/prisma";

describe("getDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.shopOrder.aggregate as any).mockResolvedValue({ _sum: { total: 150000 } });
    (prisma.shopOrder.count as any).mockResolvedValue(3);
    (prisma.shopProduct.count as any).mockResolvedValue(7);
    (prisma.shopOrder.findMany as any).mockResolvedValue([
      { id: "o1", customerName: "A", total: 50000, status: "paid", occurredAt: new Date() },
    ]);
    (prisma.shopOrderItem.groupBy as any).mockResolvedValue([
      { productName: "Kopi", _sum: { qty: 12 } },
    ]);
    (prisma.shopProduct.findMany as any).mockResolvedValue([{ id: "p1", name: "Teh", stock: 2 }]);
  });

  it("returns revenue summed only from paid/done orders this month", async () => {
    const now = new Date("2026-07-19T10:00:00");
    const result = await getDashboardSummary("user-1", now);

    expect(result.revenueThisMonth).toBe(150000);
    const aggArg = (prisma.shopOrder.aggregate as any).mock.calls[0][0];
    expect(aggArg._sum).toEqual({ total: true });
    expect(aggArg.where.userId).toBe("user-1");
    expect(aggArg.where.status).toEqual({ in: ["paid", "done"] });
    expect(aggArg.where.occurredAt).toEqual({ gte: new Date(2026, 6, 1) });
  });

  it("maps counts, top products, and low stock into the summary shape", async () => {
    const result = await getDashboardSummary("user-1", new Date("2026-07-19T10:00:00"));

    expect(result.orderCount).toBe(3);
    expect(result.activeProductCount).toBe(7);
    expect(result.topProducts).toEqual([{ productName: "Kopi", qtySold: 12 }]);
    expect(result.lowStock).toEqual([{ id: "p1", name: "Teh", stock: 2 }]);
    expect(result.recentOrders).toHaveLength(1);
  });

  it("counts unpaid orders by status new", async () => {
    (prisma.shopOrder.count as any).mockResolvedValueOnce(3).mockResolvedValueOnce(5);
    const result = await getDashboardSummary("user-1", new Date("2026-07-19T10:00:00"));
    expect(result.unpaidCount).toBe(5);
    const unpaidCall = (prisma.shopOrder.count as any).mock.calls[1][0];
    expect(unpaidCall.where).toEqual({ userId: "user-1", status: "new" });
  });
});

describe("getSalesSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one entry per day with zeroes filled for empty days", async () => {
    (prisma.shopOrder.findMany as any).mockResolvedValue([]);
    const now = new Date("2026-07-19T10:00:00");

    const series = await getSalesSeries("user-1", 7, now);

    expect(series).toHaveLength(7);
    expect(series[6].date).toBe("2026-07-19");
    expect(series[0].date).toBe("2026-07-13");
    expect(series.every((d) => d.revenue === 0)).toBe(true);
  });

  it("buckets order totals into their day", async () => {
    (prisma.shopOrder.findMany as any).mockResolvedValue([
      { total: 20000, occurredAt: new Date("2026-07-19T08:00:00") },
      { total: 5000, occurredAt: new Date("2026-07-19T20:00:00") },
      { total: 9000, occurredAt: new Date("2026-07-18T12:00:00") },
    ]);
    const now = new Date("2026-07-19T10:00:00");

    const series = await getSalesSeries("user-1", 7, now);

    const byDate = Object.fromEntries(series.map((d) => [d.date, d.revenue]));
    expect(byDate["2026-07-19"]).toBe(25000);
    expect(byDate["2026-07-18"]).toBe(9000);
  });
});
