import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  tenantName: string;
  businessName?: string | null;
  email: string;
  productLabel: string;
  planName: string;
  periodLabel: string;
  priceLabel: string;
  bank: { bankName: string; accountNumber: string; accountHolder: string; instructions: string };
}

export function invoiceNumberFor(orderId: string, createdAt: Date): string {
  const ym = `${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
  return `INV-${ym}-${orderId.slice(-6).toUpperCase()}`;
}

export async function priceLabelFor(
  product: string,
  planName: string,
  months = 1
): Promise<string> {
  const tiers = product === "metadata" ? await metadataTiers(months) : await agentTiers(months);
  return tiers.find((t) => t.name === planName)?.priceLabel ?? "Hubungi admin";
}

export async function buildInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.15);
  const muted = rgb(0.45, 0.45, 0.5);
  const { height } = page.getSize();
  let y = height - 56;

  const text = (
    s: string,
    o: { x?: number; size?: number; f?: typeof font; color?: typeof ink } = {}
  ) => page.drawText(s, { x: o.x ?? 50, y, size: o.size ?? 11, font: o.f ?? font, color: o.color ?? ink });

  text("Nerona", { size: 20, f: bold });
  text("INVOICE", { x: 470, size: 16, f: bold });
  y -= 20;
  text(`No: ${data.invoiceNumber}`, { x: 400, size: 10, color: muted });
  y -= 14;
  text(
    `Tanggal: ${data.issuedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
    { x: 400, size: 10, color: muted }
  );

  y -= 34;
  text("Ditagihkan kepada:", { f: bold });
  y -= 16;
  text(data.businessName || data.tenantName);
  y -= 14;
  text(data.email, { size: 10, color: muted });

  y -= 34;
  text("Item", { f: bold });
  text("Jumlah", { x: 430, f: bold });
  y -= 8;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.85) });
  y -= 18;
  text(`${data.productLabel} — ${data.planName}`);
  text(data.priceLabel, { x: 430 });
  y -= 14;
  text(data.periodLabel, { size: 9, color: muted });

  y -= 40;
  text("Pembayaran (transfer bank):", { f: bold });
  y -= 16;
  text(`Bank: ${data.bank.bankName || "-"}`, { size: 10 });
  y -= 14;
  text(`No. Rekening: ${data.bank.accountNumber || "-"}`, { size: 10 });
  y -= 14;
  text(`Atas Nama: ${data.bank.accountHolder || "-"}`, { size: 10 });
  if (data.bank.instructions) {
    y -= 14;
    text(data.bank.instructions, { size: 9, color: muted });
  }

  y -= 30;
  text("Setelah transfer, unggah bukti di dashboard Nerona untuk aktivasi paket.", {
    size: 9,
    color: muted,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
