import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopOrder: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { listOrdersPaged } from "@/lib/shop";
import { prisma } from "@/lib/prisma";

const baseQuery = {
  page: 1,
  pageSize: 20,
  sort: "occurredAt" as const,
  order: "desc" as const,
};

function mockDb(rows: unknown[], total: number) {
  (prisma.shopOrder.findMany as any).mockResolvedValue(rows);
  (prisma.shopOrder.count as any).mockResolvedValue(total);
}

describe("listOrdersPaged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes to userId, paginates, includes items, returns rows + total", async () => {
    mockDb([{ id: "o1", items: [] }], 1);

    const result = await listOrdersPaged("user-1", baseQuery);

    expect(result).toEqual({ rows: [{ id: "o1", items: [] }], total: 1 });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { occurredAt: "desc" },
      skip: 0,
      take: 20,
      include: { items: true },
    });
    expect(prisma.shopOrder.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("computes skip from page and pageSize", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, page: 4, pageSize: 25 });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 75, take: 25 })
    );
  });

  it("searches customerName case-insensitively", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, q: "budi" });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", customerName: { contains: "budi", mode: "insensitive" } },
      })
    );
  });

  it("filters by status", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, status: "paid" });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", status: "paid" } })
    );
  });

  it("applies an inclusive date range on occurredAt (tanggal transaksi, bukan waktu catat)", async () => {
    mockDb([], 0);
    const dateFrom = new Date("2026-07-01T00:00:00");
    const dateTo = new Date("2026-07-31T23:59:59.999");
    await listOrdersPaged("user-1", { ...baseQuery, dateFrom, dateTo });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", occurredAt: { gte: dateFrom, lte: dateTo } },
      })
    );
  });

  it("applies a total range", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, totalMin: 10000, totalMax: 50000 });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", total: { gte: 10000, lte: 50000 } },
      })
    );
  });

  it("sorts by the requested column and order", async () => {
    mockDb([], 0);
    await listOrdersPaged("user-1", { ...baseQuery, sort: "total", order: "asc" });
    expect(prisma.shopOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { total: "asc" } })
    );
  });
});
