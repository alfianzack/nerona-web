import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shop")>();
  return {
    ...actual, // ORDER_STATUSES / isOrderStatus tetap asli
    listProductsPaged: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    createOrder: vi.fn(),
    listOrdersPaged: vi.fn(),
    updateOrderStatus: vi.fn(),
  };
});

vi.mock("@/lib/shop-dashboard", () => ({ getSalesSummaryForRange: vi.fn() }));

import { executeTool, SHOP_TOOLS } from "@/lib/agent/tools";
import {
  listProductsPaged,
  createProduct,
  updateProduct,
  createOrder,
  listOrdersPaged,
  updateOrderStatus,
} from "@/lib/shop";
import { getSalesSummaryForRange } from "@/lib/shop-dashboard";

const ctx = {
  userId: "user-1",
  timezone: "Asia/Jakarta",
  now: new Date("2026-07-28T03:00:00.000Z"), // 10:00 WIB
};

/** Tool mengembalikan JSON string — dibongkar di sini supaya assertion-nya jelas. */
async function call(name: string, args: unknown) {
  return JSON.parse(await executeTool(ctx, name, JSON.stringify(args)));
}

function productsMatching(rows: unknown[]) {
  (listProductsPaged as any).mockResolvedValue({ rows, total: rows.length });
}

beforeEach(() => {
  vi.clearAllMocks();
  productsMatching([]);
  (createProduct as any).mockImplementation((_u: string, input: any) =>
    Promise.resolve({ id: "p-new", stock: null, ...input })
  );
  (updateProduct as any).mockResolvedValue({ id: "p1", name: "Nasi Goreng", price: 12_000, stock: null });
  (createOrder as any).mockImplementation((_u: string, input: any) =>
    Promise.resolve({
      id: "o1",
      customerName: input.customerName ?? null,
      status: input.status ?? "new",
      total: input.items.reduce((s: number, i: any) => s + i.qty * i.unitPrice, 0),
      occurredAt: input.occurredAt ?? ctx.now,
      items: input.items.map((i: any, idx: number) => ({ id: `i${idx}`, ...i })),
    })
  );
  (listOrdersPaged as any).mockResolvedValue({ rows: [], total: 0 });
  (updateOrderStatus as any).mockResolvedValue({ id: "o1", status: "paid", total: 20_000 });
  (getSalesSummaryForRange as any).mockResolvedValue({
    revenue: 32_000,
    orderCount: 2,
    topProducts: [{ productName: "Nasi Goreng", qtySold: 5 }],
  });
});

describe("SHOP_TOOLS", () => {
  it("exposes exactly the six tools in OpenAI function format", () => {
    expect(SHOP_TOOLS.map((t) => t.function.name)).toEqual([
      "list_products",
      "add_product",
      "record_sale",
      "list_recent_orders",
      "get_sales_summary",
      "update_order_status",
    ]);
    for (const tool of SHOP_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function.parameters.type).toBe("object");
    }
  });
});

describe("executeTool — kontrak umum", () => {
  it("returns an error result for an unknown tool instead of throwing", async () => {
    const result = await call("drop_database", {});
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns an error result for malformed argument JSON", async () => {
    const result = JSON.parse(await executeTool(ctx, "list_products", "{not json"));
    expect(result.ok).toBe(false);
  });

  it("never throws when the shop layer fails", async () => {
    (listProductsPaged as any).mockRejectedValue(new Error("db down"));
    const result = await call("list_products", {});
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("list_products", () => {
  it("scopes to the context userId and forwards the search term", async () => {
    await call("list_products", { q: "nasi" });
    expect(listProductsPaged).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ q: "nasi", status: "active" })
    );
  });

  it("caps the limit at 50", async () => {
    await call("list_products", { limit: 500 });
    expect(listProductsPaged).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ pageSize: 50 })
    );
  });

  it("returns a compact product list", async () => {
    productsMatching([{ id: "p1", name: "Nasi Goreng", price: 10_000, stock: 3 }]);
    const result = await call("list_products", {});
    expect(result).toEqual({
      ok: true,
      products: [{ name: "Nasi Goreng", price: 10_000, stock: 3 }],
      total: 1,
    });
  });
});

describe("add_product", () => {
  it("creates a product that does not exist yet", async () => {
    const result = await call("add_product", { name: "Nasi Goreng", price: 10_000 });
    expect(createProduct).toHaveBeenCalledWith("user-1", {
      name: "Nasi Goreng",
      price: 10_000,
      stock: null,
      description: null,
    });
    expect(result.ok).toBe(true);
    expect(result.action).toBe("created");
  });

  it("updates the price instead of creating a duplicate name (case-insensitive)", async () => {
    productsMatching([{ id: "p1", name: "nasi goreng", price: 8_000, stock: null }]);

    const result = await call("add_product", { name: "Nasi Goreng", price: 12_000 });

    expect(createProduct).not.toHaveBeenCalled();
    expect(updateProduct).toHaveBeenCalledWith("user-1", "p1", { price: 12_000 });
    expect(result.action).toBe("updated");
  });

  it("treats a name that only CONTAINS the query as a different product", async () => {
    productsMatching([{ id: "p1", name: "Nasi Goreng Spesial", price: 15_000, stock: null }]);

    const result = await call("add_product", { name: "Nasi Goreng", price: 10_000 });

    expect(createProduct).toHaveBeenCalled();
    expect(result.action).toBe("created");
  });

  it("passes stock through when given", async () => {
    await call("add_product", { name: "Es Teh", price: 3_000, stock: 20 });
    expect(createProduct).toHaveBeenCalledWith("user-1", expect.objectContaining({ stock: 20 }));
  });

  it("rejects a blank name", async () => {
    const result = await call("add_product", { name: "   ", price: 1_000 });
    expect(result.ok).toBe(false);
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("rejects a negative or non-integer price", async () => {
    expect((await call("add_product", { name: "A", price: -1 })).ok).toBe(false);
    expect((await call("add_product", { name: "A", price: 10.5 })).ok).toBe(false);
    expect(createProduct).not.toHaveBeenCalled();
  });
});

describe("record_sale", () => {
  it("links a single matching product and defaults the price to the product price", async () => {
    productsMatching([{ id: "p1", name: "Nasi Goreng", price: 10_000, stock: null }]);

    const result = await call("record_sale", {
      items: [{ product_name: "nasi goreng", qty: 2 }],
      customer_name: "Bu Ani",
    });

    expect(createOrder).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        customerName: "Bu Ani",
        status: "paid",
        items: [{ productId: "p1", productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 }],
      })
    );
    expect(result.ok).toBe(true);
    expect(result.order.total).toBe(20_000);
  });

  it("asks which product was meant when several match, saving nothing", async () => {
    productsMatching([
      { id: "p1", name: "Nasi Goreng", price: 10_000, stock: null },
      { id: "p2", name: "Nasi Goreng Spesial", price: 15_000, stock: null },
    ]);

    const result = await call("record_sale", { items: [{ product_name: "nasi", qty: 1 }] });

    expect(result.ok).toBe(false);
    expect(result.candidates).toEqual([
      { name: "Nasi Goreng", price: 10_000 },
      { name: "Nasi Goreng Spesial", price: 15_000 },
    ]);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("prefers an exact name match over the other candidates", async () => {
    productsMatching([
      { id: "p1", name: "Nasi Goreng", price: 10_000, stock: null },
      { id: "p2", name: "Nasi Goreng Spesial", price: 15_000, stock: null },
    ]);

    const result = await call("record_sale", { items: [{ product_name: "Nasi Goreng", qty: 1 }] });

    expect(result.ok).toBe(true);
    expect((createOrder as any).mock.calls[0][1].items[0].productId).toBe("p1");
  });

  it("rejects an unknown product when no price is given", async () => {
    const result = await call("record_sale", { items: [{ product_name: "Sate Padang", qty: 1 }] });
    expect(result.ok).toBe(false);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("allows an unknown product as a free-text item when a price is given", async () => {
    const result = await call("record_sale", {
      items: [{ product_name: "Sate Padang", qty: 1, unit_price: 25_000 }],
    });
    expect(result.ok).toBe(true);
    expect((createOrder as any).mock.calls[0][1].items[0]).toEqual({
      productId: null,
      productName: "Sate Padang",
      qty: 1,
      unitPrice: 25_000,
    });
  });

  it("requires at least one item", async () => {
    expect((await call("record_sale", { items: [] })).ok).toBe(false);
    expect((await call("record_sale", {})).ok).toBe(false);
  });

  it("rejects qty below 1 and a negative price", async () => {
    expect(
      (await call("record_sale", { items: [{ product_name: "X", qty: 0, unit_price: 100 }] })).ok
    ).toBe(false);
    expect(
      (await call("record_sale", { items: [{ product_name: "X", qty: 1, unit_price: -5 }] })).ok
    ).toBe(false);
  });

  it("rejects an invalid status", async () => {
    const result = await call("record_sale", {
      items: [{ product_name: "X", qty: 1, unit_price: 100 }],
      status: "lunas",
    });
    expect(result.ok).toBe(false);
  });

  it("stores a backdated date at 12:00 in the profile timezone", async () => {
    const result = await call("record_sale", {
      items: [{ product_name: "X", qty: 1, unit_price: 100 }],
      date: "2026-06-15",
    });

    // 12:00 WIB (UTC+7) = 05:00 UTC — hari tidak bergeser saat ditampilkan kembali.
    expect((createOrder as any).mock.calls[0][1].occurredAt.toISOString()).toBe(
      "2026-06-15T05:00:00.000Z"
    );
    expect(result.order.date).toBe("2026-06-15");
  });

  it("handles a timezone west of UTC too", async () => {
    await executeTool(
      { ...ctx, timezone: "America/New_York" },
      "record_sale",
      JSON.stringify({ items: [{ product_name: "X", qty: 1, unit_price: 100 }], date: "2026-06-15" })
    );
    // 12:00 EDT (UTC-4) = 16:00 UTC
    expect((createOrder as any).mock.calls[0][1].occurredAt.toISOString()).toBe(
      "2026-06-15T16:00:00.000Z"
    );
  });

  it("leaves occurredAt unset when no date is given", async () => {
    await call("record_sale", { items: [{ product_name: "X", qty: 1, unit_price: 100 }] });
    expect((createOrder as any).mock.calls[0][1].occurredAt).toBeUndefined();
  });

  it("rejects a date that is not YYYY-MM-DD", async () => {
    const result = await call("record_sale", {
      items: [{ product_name: "X", qty: 1, unit_price: 100 }],
      date: "15 Juni 2026",
    });
    expect(result.ok).toBe(false);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rejects a calendar date that does not exist", async () => {
    const result = await call("record_sale", {
      items: [{ product_name: "X", qty: 1, unit_price: 100 }],
      date: "2026-02-31",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a date more than a year away in either direction", async () => {
    const past = await call("record_sale", {
      items: [{ product_name: "X", qty: 1, unit_price: 100 }],
      date: "2024-01-01",
    });
    const future = await call("record_sale", {
      items: [{ product_name: "X", qty: 1, unit_price: 100 }],
      date: "2028-01-01",
    });
    expect(past.ok).toBe(false);
    expect(future.ok).toBe(false);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("accepts a date just inside the one-year window", async () => {
    const result = await call("record_sale", {
      items: [{ product_name: "X", qty: 1, unit_price: 100 }],
      date: "2025-09-01",
    });
    expect(result.ok).toBe(true);
  });
});

describe("list_recent_orders", () => {
  it("defaults to 5 orders and forwards a status filter", async () => {
    await call("list_recent_orders", { status: "paid" });
    expect(listOrdersPaged).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ pageSize: 5, status: "paid", sort: "occurredAt", order: "desc" })
    );
  });

  it("caps the limit at 20", async () => {
    await call("list_recent_orders", { limit: 100 });
    expect(listOrdersPaged).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ pageSize: 20 })
    );
  });

  it("returns orders with their items and the transaction date", async () => {
    (listOrdersPaged as any).mockResolvedValue({
      rows: [
        {
          id: "o1",
          customerName: "Bu Ani",
          status: "paid",
          total: 20_000,
          occurredAt: new Date("2026-06-15T05:00:00.000Z"),
          items: [{ productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 }],
        },
      ],
      total: 1,
    });

    const result = await call("list_recent_orders", {});

    expect(result.orders).toEqual([
      {
        id: "o1",
        customer_name: "Bu Ani",
        status: "paid",
        total: 20_000,
        date: "2026-06-15",
        items: [{ name: "Nasi Goreng", qty: 2, unit_price: 10_000 }],
      },
    ]);
  });

  it("rejects an invalid status filter", async () => {
    expect((await call("list_recent_orders", { status: "lunas" })).ok).toBe(false);
  });
});

describe("record_sale — peringatan stok", () => {
  it("passes the stock warning through so the agent can tell the owner", async () => {
    productsMatching([{ id: "p1", name: "Nasi Goreng", price: 10_000, stock: 1 }]);
    (createOrder as any).mockResolvedValue({
      id: "o1",
      customerName: null,
      status: "paid",
      total: 30_000,
      occurredAt: ctx.now,
      items: [{ productName: "Nasi Goreng", qty: 3, unitPrice: 10_000 }],
      stockWarnings: [{ productName: "Nasi Goreng", requested: 3, available: 1 }],
    });

    const result = await call("record_sale", { items: [{ product_name: "Nasi Goreng", qty: 3 }] });

    expect(result.ok).toBe(true);
    expect(result.stock_warnings).toEqual([
      { product_name: "Nasi Goreng", requested: 3, available: 1 },
    ]);
  });

  it("omits the key entirely when no stock ran short", async () => {
    productsMatching([{ id: "p1", name: "Nasi Goreng", price: 10_000, stock: 10 }]);
    const result = await call("record_sale", { items: [{ product_name: "Nasi Goreng", qty: 1 }] });
    expect(result.stock_warnings).toBeUndefined();
  });
});

describe("get_sales_summary", () => {
  function rangeArg() {
    return (getSalesSummaryForRange as any).mock.calls[0][1];
  }

  it("returns revenue, transaction count, and best sellers", async () => {
    const result = await call("get_sales_summary", { period: "today" });

    expect(result).toEqual({
      ok: true,
      period: "today",
      revenue: 32_000,
      order_count: 2,
      top_products: [{ name: "Nasi Goreng", qty_sold: 5 }],
    });
    expect(getSalesSummaryForRange).toHaveBeenCalledWith("user-1", expect.any(Object));
  });

  it("starts today at local midnight in the profile timezone", async () => {
    // ctx.now = 2026-07-28T03:00:00Z = 10:00 WIB, jadi tengah malam lokal = 27 Jul 17:00Z
    await call("get_sales_summary", { period: "today" });
    expect(rangeArg().from.toISOString()).toBe("2026-07-27T17:00:00.000Z");
    expect(rangeArg().to.getTime()).toBe(ctx.now.getTime());
  });

  it("covers the last 7 local days for week, including today", async () => {
    await call("get_sales_summary", { period: "week" });
    // tengah malam lokal 22 Juli = 21 Jul 17:00Z
    expect(rangeArg().from.toISOString()).toBe("2026-07-21T17:00:00.000Z");
  });

  it("starts month at the 1st of the current local month", async () => {
    await call("get_sales_summary", { period: "month" });
    // tengah malam lokal 1 Juli = 30 Jun 17:00Z
    expect(rangeArg().from.toISOString()).toBe("2026-06-30T17:00:00.000Z");
  });

  it("defaults to today when no period is given", async () => {
    const result = await call("get_sales_summary", {});
    expect(result.period).toBe("today");
  });

  it("rejects an unknown period", async () => {
    const result = await call("get_sales_summary", { period: "tahun" });
    expect(result.ok).toBe(false);
    expect(getSalesSummaryForRange).not.toHaveBeenCalled();
  });
});

describe("update_order_status", () => {
  it("updates an order the owner owns", async () => {
    const result = await call("update_order_status", { order_id: "o1", status: "paid" });

    expect(updateOrderStatus).toHaveBeenCalledWith("user-1", "o1", "paid");
    expect(result).toEqual({ ok: true, order: { id: "o1", status: "paid" } });
  });

  it("treats cancelled as the way to \"delete\" from chat", async () => {
    (updateOrderStatus as any).mockResolvedValue({ id: "o1", status: "cancelled" });
    const result = await call("update_order_status", { order_id: "o1", status: "cancelled" });
    expect(result.order.status).toBe("cancelled");
  });

  it("fails when the order is not the owner's", async () => {
    (updateOrderStatus as any).mockResolvedValue(null);
    const result = await call("update_order_status", { order_id: "punya-orang-lain", status: "paid" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing order_id or an invalid status", async () => {
    expect((await call("update_order_status", { status: "paid" })).ok).toBe(false);
    expect((await call("update_order_status", { order_id: "o1", status: "lunas" })).ok).toBe(false);
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
