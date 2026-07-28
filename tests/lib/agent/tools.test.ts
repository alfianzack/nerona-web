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
  };
});

import { executeTool, SHOP_TOOLS } from "@/lib/agent/tools";
import {
  listProductsPaged,
  createProduct,
  updateProduct,
  createOrder,
  listOrdersPaged,
} from "@/lib/shop";

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
});

describe("SHOP_TOOLS", () => {
  it("exposes exactly the four tools in OpenAI function format", () => {
    expect(SHOP_TOOLS.map((t) => t.function.name)).toEqual([
      "list_products",
      "add_product",
      "record_sale",
      "list_recent_orders",
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
