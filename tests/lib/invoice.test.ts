import { describe, expect, it } from "vitest";
import { buildInvoicePdf, invoiceNumberFor, type InvoiceData } from "@/lib/billing/invoice";

const base: InvoiceData = {
  invoiceNumber: "INV-202607-ABC123",
  issuedAt: new Date("2026-07-24T00:00:00Z"),
  tenantName: "Toko Maju",
  businessName: "Toko Maju Jaya",
  email: "toko@example.com",
  productLabel: "Agent WhatsApp",
  planName: "Pro",
  periodLabel: "Perpanjangan 1 bulan",
  priceLabel: "Rp 99.000",
  bank: { bankName: "BCA", accountNumber: "1234567890", accountHolder: "PT Nerona", instructions: "Transfer tepat nominal" },
};

describe("invoiceNumberFor", () => {
  it("is deterministic from order id + createdAt month", () => {
    expect(invoiceNumberFor("clabc000def123456", new Date("2026-07-01T00:00:00Z"))).toBe("INV-202607-123456");
  });
});

describe("buildInvoicePdf", () => {
  it("returns a PDF buffer (starts with %PDF-)", async () => {
    const buf = await buildInvoicePdf(base);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("does not throw with empty bank fields and no businessName", async () => {
    const buf = await buildInvoicePdf({
      ...base,
      businessName: null,
      bank: { bankName: "", accountNumber: "", accountHolder: "", instructions: "" },
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
