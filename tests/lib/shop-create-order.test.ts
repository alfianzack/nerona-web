import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopOrder: { create: vi.fn() },
    shopProduct: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { createOrder } from "@/lib/shop";
import { prisma } from "@/lib/prisma";

const items = [{ productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 }];

function createArg() {
  return (prisma.shopOrder.create as any).mock.calls[0][0];
}

/** Produk yang "ada" saat stok dikurangi. */
function stockRows(rows: unknown[]) {
  (prisma.shopProduct.findMany as any).mockResolvedValue(rows);
}

function updateArgs() {
  return (prisma.shopProduct.update as any).mock.calls.map((c: any[]) => c[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Transaksi dijalankan dengan client yang sama supaya assertion tetap sederhana.
  (prisma.$transaction as any).mockImplementation((fn: any) => fn(prisma));
  (prisma.shopOrder.create as any).mockResolvedValue({ id: "o1", items: [] });
  stockRows([]);
});

describe("createOrder", () => {
  it("computes the total from qty * unitPrice", async () => {
    await createOrder("user-1", { items });
    expect(createArg().data.total).toBe(20_000);
  });

  it("defaults status to new so the web flow is unchanged", async () => {
    await createOrder("user-1", { items });
    expect(createArg().data.status).toBeUndefined();
  });

  it("honors an explicit status", async () => {
    await createOrder("user-1", { items, status: "paid" });
    expect(createArg().data.status).toBe("paid");
  });

  it("leaves occurredAt to the database default when no date is given", async () => {
    await createOrder("user-1", { items });
    expect(createArg().data.occurredAt).toBeUndefined();
  });

  it("records a backdated occurredAt when given one", async () => {
    const occurredAt = new Date("2026-06-15T05:00:00.000Z");
    await createOrder("user-1", { items, occurredAt });
    expect(createArg().data.occurredAt).toBe(occurredAt);
  });

  it("drops items with an empty name or non-positive qty", async () => {
    await createOrder("user-1", {
      items: [...items, { productName: "", qty: 1, unitPrice: 500 }, { productName: "X", qty: 0, unitPrice: 500 }],
    });
    expect(createArg().data.items.create).toHaveLength(1);
    expect(createArg().data.total).toBe(20_000);
  });

  it("runs the order and the stock change in one transaction", async () => {
    await createOrder("user-1", { items });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("createOrder — pengurangan stok", () => {
  it("decrements stock for a registered product", async () => {
    stockRows([{ id: "p1", name: "Nasi Goreng", stock: 10 }]);

    const order = await createOrder("user-1", {
      items: [{ productId: "p1", productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 }],
    });

    expect(updateArgs()).toEqual([{ where: { id: "p1" }, data: { stock: 8 } }]);
    expect(order.stockWarnings).toEqual([]);
  });

  it("looks products up scoped to the owner", async () => {
    stockRows([{ id: "p1", name: "Nasi Goreng", stock: 10 }]);
    await createOrder("user-1", {
      items: [{ productId: "p1", productName: "Nasi Goreng", qty: 1, unitPrice: 10_000 }],
    });
    expect(prisma.shopProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", id: { in: ["p1"] } } })
    );
  });

  it("leaves a product whose stock is not tracked untouched", async () => {
    stockRows([{ id: "p1", name: "Nasi Goreng", stock: null }]);

    const order = await createOrder("user-1", {
      items: [{ productId: "p1", productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 }],
    });

    expect(prisma.shopProduct.update).not.toHaveBeenCalled();
    expect(order.stockWarnings).toEqual([]);
  });

  it("skips free-text items that are not linked to a product", async () => {
    await createOrder("user-1", {
      items: [{ productId: null, productName: "Sate Padang", qty: 1, unitPrice: 25_000 }],
    });
    expect(prisma.shopProduct.findMany).not.toHaveBeenCalled();
    expect(prisma.shopProduct.update).not.toHaveBeenCalled();
  });

  it("sums the quantity when the same product appears twice in one order", async () => {
    stockRows([{ id: "p1", name: "Nasi Goreng", stock: 10 }]);

    await createOrder("user-1", {
      items: [
        { productId: "p1", productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 },
        { productId: "p1", productName: "Nasi Goreng", qty: 3, unitPrice: 10_000 },
      ],
    });

    expect(updateArgs()).toEqual([{ where: { id: "p1" }, data: { stock: 5 } }]);
  });

  it("stops at zero instead of going negative, and warns", async () => {
    stockRows([{ id: "p1", name: "Nasi Goreng", stock: 1 }]);

    const order = await createOrder("user-1", {
      items: [{ productId: "p1", productName: "Nasi Goreng", qty: 3, unitPrice: 10_000 }],
    });

    expect(updateArgs()).toEqual([{ where: { id: "p1" }, data: { stock: 0 } }]);
    // Penjualan TETAP tersimpan — data stok yang basi tidak boleh menggagalkan
    // transaksi yang sudah terjadi.
    expect(order.id).toBe("o1");
    expect(order.stockWarnings).toEqual([
      { productName: "Nasi Goreng", requested: 3, available: 1 },
    ]);
  });

  it("warns per product when several run short", async () => {
    stockRows([
      { id: "p1", name: "Nasi Goreng", stock: 1 },
      { id: "p2", name: "Mie Goreng", stock: 0 },
    ]);

    const order = await createOrder("user-1", {
      items: [
        { productId: "p1", productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 },
        { productId: "p2", productName: "Mie Goreng", qty: 1, unitPrice: 12_000 },
      ],
    });

    expect(order.stockWarnings).toEqual([
      { productName: "Nasi Goreng", requested: 2, available: 1 },
      { productName: "Mie Goreng", requested: 1, available: 0 },
    ]);
  });

  it("ignores a productId that does not belong to the owner", async () => {
    stockRows([]); // pencarian ber-scope userId tidak menemukan apa pun

    const order = await createOrder("user-1", {
      items: [{ productId: "milik-orang-lain", productName: "X", qty: 1, unitPrice: 100 }],
    });

    expect(prisma.shopProduct.update).not.toHaveBeenCalled();
    expect(order.stockWarnings).toEqual([]);
  });
});
