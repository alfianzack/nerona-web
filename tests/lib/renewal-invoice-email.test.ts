import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("resend", () => ({ Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })) }));
vi.mock("@/lib/base-url", () => ({ baseUrl: () => "https://app.test" }));

import { sendRenewalInvoiceEmail } from "@/lib/mail";

beforeEach(() => sendMock.mockReset());

describe("sendRenewalInvoiceEmail", () => {
  it("sends an email with the invoice PDF attached", async () => {
    const pdf = Buffer.from("%PDF-fake");
    await sendRenewalInvoiceEmail("toko@example.com", {
      tenantName: "Toko Maju",
      productLabel: "Agent WhatsApp",
      planName: "Pro",
      priceLabel: "Rp 99.000",
      invoiceNumber: "INV-202607-ABC123",
      pdf,
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("toko@example.com");
    expect(typeof arg.subject).toBe("string");
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].filename).toContain("INV-202607-ABC123");
    expect(arg.attachments[0].content).toBe(pdf);
  });
});
