import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopProduct: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { listProductsPaged, LOW_STOCK_THRESHOLD } from "@/lib/shop";
import { prisma } from "@/lib/prisma";

const baseQuery = {
  page: 1,
  pageSize: 20,
  sort: "createdAt" as const,
  order: "desc" as const,
};

function mockDb(rows: unknown[], total: number) {
  (prisma.shopProduct.findMany as any).mockResolvedValue(rows);
  (prisma.shopProduct.count as any).mockResolvedValue(total);
}

describe("listProductsPaged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes to userId, paginates, and returns rows + total", async () => {
    mockDb([{ id: "p1" }], 1);

    const result = await listProductsPaged("user-1", baseQuery);

    expect(result).toEqual({ rows: [{ id: "p1" }], total: 1 });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    });
    expect(prisma.shopProduct.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("computes skip from page and pageSize", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, page: 3, pageSize: 10 });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("adds a case-insensitive name search", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, q: "kopi" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", name: { contains: "kopi", mode: "insensitive" } },
      })
    );
  });

  it("filters by active/inactive status", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, status: "inactive" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", isActive: false } })
    );
  });

  it("filters low stock at or below the threshold", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, stockFilter: "low" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", stock: { lte: LOW_STOCK_THRESHOLD } },
      })
    );
  });

  it("filters out-of-stock as exactly zero", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, stockFilter: "out" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", stock: 0 } })
    );
  });

  it("applies a price range", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, priceMin: 1000, priceMax: 5000 });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", price: { gte: 1000, lte: 5000 } },
      })
    );
  });

  it("sorts by the requested column and order", async () => {
    mockDb([], 0);
    await listProductsPaged("user-1", { ...baseQuery, sort: "price", order: "asc" });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: "asc" } })
    );
  });
});
