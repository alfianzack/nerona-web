import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pointTransaction: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getBalance, adjustPoints, spendPoints, listTransactions } from "@/lib/points";
import { prisma } from "@/lib/prisma";

beforeEach(() => vi.clearAllMocks());

describe("getBalance", () => {
  it("returns the summed delta", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: 1250 } });
    expect(await getBalance("u1")).toBe(1250);
  });

  it("returns 0 when the ledger is empty", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: null } });
    expect(await getBalance("u1")).toBe(0);
  });
});

describe("adjustPoints", () => {
  beforeEach(() => {
    (prisma.$transaction as any).mockImplementation((cb: any) => cb(prisma));
  });

  it("creates a manual_adjust row and returns the new balance", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: 100 } });
    const res = await adjustPoints({ userId: "u1", delta: 50, note: "bonus", createdById: "admin1" });
    expect(res).toEqual({ ok: true, balance: 150 });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: 50, reason: "manual_adjust", note: "bonus", createdById: "admin1" },
    });
  });

  it("rejects an adjustment that would go below zero", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: 20 } });
    const res = await adjustPoints({ userId: "u1", delta: -50, createdById: "admin1" });
    expect(res).toEqual({ ok: false, reason: "below_zero" });
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });

  it("retries once on a Prisma serialization failure (P2034) and returns the success value", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: 100 } });
    const serializationError = Object.assign(new Error("could not serialize access"), { code: "P2034" });
    (prisma.$transaction as any)
      .mockRejectedValueOnce(serializationError)
      .mockImplementationOnce((cb: any) => cb(prisma));

    const res = await adjustPoints({ userId: "u1", delta: 50, note: "bonus", createdById: "admin1" });

    expect(res).toEqual({ ok: true, balance: 150 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: 50, reason: "manual_adjust", note: "bonus", createdById: "admin1" },
    });
  });
});

describe("spendPoints", () => {
  it("always writes a negative spend row and returns the new balance", async () => {
    (prisma.pointTransaction.aggregate as any).mockResolvedValue({ _sum: { delta: -5 } });
    const bal = await spendPoints({ userId: "u1", cost: 10, note: "AI reply" });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: { userId: "u1", delta: -10, reason: "spend", note: "AI reply", createdById: null },
    });
    expect(bal).toBe(-5);
  });

  it("throws for a zero cost and does not create a row", async () => {
    await expect(spendPoints({ userId: "u1", cost: 0 })).rejects.toThrow(
      "spendPoints: cost must be a positive integer",
    );
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });

  it("throws for a non-integer cost and does not create a row", async () => {
    await expect(spendPoints({ userId: "u1", cost: 1.5 })).rejects.toThrow(
      "spendPoints: cost must be a positive integer",
    );
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });

  it("throws for a negative cost and does not create a row", async () => {
    await expect(spendPoints({ userId: "u1", cost: -5 })).rejects.toThrow(
      "spendPoints: cost must be a positive integer",
    );
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });
});

describe("listTransactions", () => {
  it("maps rows to views with the admin name", async () => {
    (prisma.pointTransaction.findMany as any).mockResolvedValue([
      { id: "t1", delta: 50, reason: "manual_adjust", note: "bonus", createdAt: new Date("2026-07-23"), createdBy: { name: "Fahmi", email: "f@x.com" } },
    ]);
    const rows = await listTransactions("u1");
    expect(rows[0]).toMatchObject({ id: "t1", delta: 50, createdByName: "Fahmi" });
  });
});
