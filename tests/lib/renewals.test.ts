import { beforeEach, describe, expect, it, vi } from "vitest";

// Most of this suite is about agent renewals, which the shipped build skips
// while AGENT_ENABLED is false. Forced on here so these keep testing the
// generator's logic; the skipping itself is covered in
// agent-hidden-orders.test.ts.
vi.mock("@/lib/features", () => ({ AGENT_ENABLED: true }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentProfile: { findMany: vi.fn() },
    license: { findMany: vi.fn() },
    orderRequest: { count: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/billing/invoice", () => ({
  buildInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-x")),
  invoiceNumberFor: vi.fn(() => "INV-TEST"),
  priceLabelFor: vi.fn().mockResolvedValue("Rp 99.000"),
}));
vi.mock("@/lib/mail", () => ({ sendRenewalInvoiceEmail: vi.fn() }));
vi.mock("@/lib/payment-settings", () => ({
  getPaymentSettings: vi.fn().mockResolvedValue({ bankName: "BCA", accountNumber: "1", accountHolder: "N", instructions: "" }),
}));

import { generateDueRenewals } from "@/lib/billing/renewals";
import { prisma } from "@/lib/prisma";
import { sendRenewalInvoiceEmail } from "@/lib/mail";
import { buildInvoicePdf } from "@/lib/billing/invoice";

const now = new Date("2026-07-29T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.agentProfile.findMany as any).mockResolvedValue([]);
  (prisma.license.findMany as any).mockResolvedValue([]);
  (prisma.orderRequest.count as any).mockResolvedValue(0);
  (prisma.orderRequest.create as any).mockResolvedValue({ id: "req-1", createdAt: new Date("2026-07-24T00:00:00Z") });
});

describe("generateDueRenewals", () => {
  it("creates an agent renewal for a due paid profile with no pending request", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([
      { userId: "u1", plan: "pro", user: { email: "u1@example.com", name: "U1", businessName: null } },
    ]);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "u1", product: "agent", planName: "Pro", durationMonths: 1, isRenewal: true },
    });
    expect(res.created).toBe(1);
  });

  it("skips when a pending request already exists (idempotent)", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([
      { userId: "u1", plan: "pro", user: { email: "u1@example.com", name: "U1", businessName: null } },
    ]);
    (prisma.orderRequest.count as any).mockResolvedValue(1);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).not.toHaveBeenCalled();
    expect(res.created).toBe(0);
  });

  it("creates a metadata renewal from an active license's plan name", async () => {
    (prisma.license.findMany as any).mockResolvedValue([
      { userId: "u2", plan: { name: "Business" }, user: { email: "u2@example.com", name: null, businessName: null } },
    ]);
    const res = await generateDueRenewals(now, 3);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "u2", product: "metadata", planName: "Business", durationMonths: 1, isRenewal: true },
    });
    expect(res.created).toBe(1);
  });

  it("queries with a cutoff = now + leadDays and paid/active filters", async () => {
    await generateDueRenewals(now, 7);
    const agentWhere = (prisma.agentProfile.findMany as any).mock.calls[0][0].where;
    expect(agentWhere.status).toBe("active");
    expect(agentWhere.plan).toEqual({ in: ["pro", "business"] });
    expect(agentWhere.planExpiresAt.lte instanceof Date).toBe(true);
  });

  it("creates an agent renewal and emails an invoice for a due paid profile", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([
      { userId: "u1", plan: "pro", user: { email: "u1@example.com", name: "U1", businessName: null } },
    ]);
    const res = await generateDueRenewals(now, 7);
    expect(prisma.orderRequest.create).toHaveBeenCalledWith({
      data: { userId: "u1", product: "agent", planName: "Pro", durationMonths: 1, isRenewal: true },
    });
    expect(buildInvoicePdf).toHaveBeenCalledTimes(1);
    expect(sendRenewalInvoiceEmail).toHaveBeenCalledWith(
      "u1@example.com",
      expect.objectContaining({ productLabel: "Agent WhatsApp", planName: "Pro", pdf: expect.any(Buffer) })
    );
    expect(res.created).toBe(1);
  });

  it("still creates the renewal when the invoice email fails (best-effort)", async () => {
    (prisma.agentProfile.findMany as any).mockResolvedValue([
      { userId: "u1", plan: "pro", user: { email: "u1@example.com", name: "U1", businessName: null } },
    ]);
    (sendRenewalInvoiceEmail as any).mockRejectedValueOnce(new Error("smtp down"));
    const res = await generateDueRenewals(now, 7);
    expect(prisma.orderRequest.create).toHaveBeenCalled();
    expect(res.created).toBe(1);
  });
});
