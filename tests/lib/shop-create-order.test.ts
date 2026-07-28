import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopOrder: { create: vi.fn() },
  },
}));

import { createOrder } from "@/lib/shop";
import { prisma } from "@/lib/prisma";

const items = [{ productName: "Nasi Goreng", qty: 2, unitPrice: 10_000 }];

function createArg() {
  return (prisma.shopOrder.create as any).mock.calls[0][0];
}

describe("createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.shopOrder.create as any).mockResolvedValue({ id: "o1", items: [] });
  });

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
});
