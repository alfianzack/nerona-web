import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/orders", () => ({ getUserOrder: vi.fn() }));
vi.mock("@/lib/payment-settings", () => ({ getPaymentSettings: vi.fn().mockResolvedValue({ bankName: "BCA", accountNumber: "1", accountHolder: "N", instructions: "" }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/billing/invoice", () => ({
  buildInvoicePdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-x")),
  invoiceNumberFor: vi.fn(() => "INV-TEST"),
  priceLabelFor: vi.fn().mockResolvedValue("Rp 99.000"),
}));

import { GET } from "@/app/api/orders/[id]/invoice/route";
import { getServerSession } from "next-auth";
import { getUserOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

function req() { return new Request("http://test/api/orders/o1/invoice"); }
const ctx = { params: { id: "o1" } };

beforeEach(() => vi.clearAllMocks());

describe("GET /api/orders/[id]/invoice", () => {
  it("401 when unauthenticated", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(401);
  });
  it("404 when the order is not owned/found", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (getUserOrder as any).mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });
  it("returns the PDF for an owned order", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
    (getUserOrder as any).mockResolvedValue({ id: "o1", product: "agent", planName: "Pro", createdAt: new Date("2026-07-24T00:00:00Z") });
    (prisma.user.findUnique as any).mockResolvedValue({ email: "u1@example.com", name: "U1", businessName: null });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
