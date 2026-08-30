import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock objects are declared inside the factories, not as top-level consts:
// vi.mock is hoisted above the file's declarations, so a factory that closes
// over a const throws "Cannot access before initialization". This matches how
// tests/lib/renewals.test.ts and the rest of the suite do it.
vi.mock("@/lib/ai-usage", () => ({ recordAiUsage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orderRequest: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    agentProfile: { findMany: vi.fn() },
    license: { findMany: vi.fn() },
    plan: { findFirst: vi.fn() },
    // Saklar auto-renew; suite ini menguji penyembunyian Agent, jadi saklarnya
    // dinyalakan supaya yang diuji tetap logikanya.
    setting: { findUnique: vi.fn(async () => ({ value: "1" })) },
  },
}));

vi.mock("@/lib/features", () => ({ AGENT_ENABLED: false }));

// The renewal generator emails an invoice per row; none of that is under test.
vi.mock("@/lib/payment-settings", () => ({
  getPaymentSettings: vi.fn().mockResolvedValue({
    bankName: "BCA",
    accountNumber: "1",
    accountHolder: "N",
    instructions: "",
  }),
}));
vi.mock("@/lib/billing/invoice", () => ({
  buildInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-x")),
  invoiceNumberFor: vi.fn(() => "INV-TEST"),
  priceLabelFor: vi.fn().mockResolvedValue("Rp 99.000"),
}));
vi.mock("@/lib/mail", () => ({ sendRenewalInvoiceEmail: vi.fn() }));

import { listPendingRenewals, submitOrder } from "@/lib/orders";
import { generateDueRenewals } from "@/lib/billing/renewals";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.orderRequest.count as any).mockResolvedValue(0);
  (prisma.orderRequest.findFirst as any).mockResolvedValue(null);
  (prisma.orderRequest.findMany as any).mockResolvedValue([]);
  (prisma.orderRequest.create as any).mockResolvedValue({
    id: "req-1",
    createdAt: new Date("2026-07-31T00:00:00Z"),
  });
  (prisma.agentProfile.findMany as any).mockResolvedValue([]);
  (prisma.license.findMany as any).mockResolvedValue([]);
  (prisma.plan.findFirst as any).mockResolvedValue({ id: "p1", name: "Pro" });
});

describe("submitOrder with agent hidden", () => {
  it("refuses a paid agent order", async () => {
    const result = await submitOrder("u1", "agent", "Pro");
    expect(result).toEqual({ ok: false, reason: "invalid_product" });
    expect(prisma.orderRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a FREE agent activation too", async () => {
    // submitOrder routes Free straight to activateFreeAgent, so the guard has
    // to sit above that branch or free activation slips through.
    const result = await submitOrder("u1", "agent", "Free");
    expect(result).toEqual({ ok: false, reason: "invalid_product" });
  });

  it("still accepts a metadata order", async () => {
    const result = await submitOrder("u1", "metadata", "Pro");
    expect(result.ok).toBe(true);
    expect(prisma.orderRequest.create).toHaveBeenCalled();
  });

  it("still rejects a genuinely unknown product", async () => {
    const result = await submitOrder("u1", "spaceship", "Pro");
    expect(result).toEqual({ ok: false, reason: "invalid_product" });
  });
});

describe("renewals with agent hidden", () => {
  it("creates no agent renewal even when an agent plan is due", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([
      {
        userId: "u1",
        plan: "pro",
        planDurationMonths: 1,
        user: { email: "a@b.c", name: "A", businessName: null },
      },
    ]);

    const result = await generateDueRenewals(new Date("2026-08-01"));

    expect(result.created).toBe(0);
    expect(prisma.orderRequest.create).not.toHaveBeenCalled();
  });

  it("does not even query agent profiles it will skip", async () => {
    await generateDueRenewals(new Date("2026-08-01"));
    expect(prisma.agentProfile.findMany).not.toHaveBeenCalled();
  });

  it("still creates metadata renewals", async () => {
    (prisma.license.findMany as any).mockResolvedValue([
      {
        userId: "u2",
        durationMonths: 1,
        plan: { name: "Pro" },
        user: { email: "c@d.e", name: "C", businessName: null },
      },
    ]);

    const result = await generateDueRenewals(new Date("2026-08-01"));

    expect(result.created).toBe(1);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ product: "metadata" }) })
    );
  });
});

describe("listPendingRenewals with agent hidden", () => {
  it("asks the database for metadata renewals only", async () => {
    await listPendingRenewals("u1");
    expect(prisma.orderRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ product: "metadata" }),
      })
    );
  });
});
