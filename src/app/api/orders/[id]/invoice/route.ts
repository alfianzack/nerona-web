import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOrder } from "@/lib/orders";
import { getPaymentSettings } from "@/lib/payment-settings";
import { buildInvoicePdf, invoiceNumberFor, priceLabelFor } from "@/lib/billing/invoice";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const order = await getUserOrder(session.user.id, params.id);
  if (!order) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const [user, bank, priceLabel] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, businessName: true },
    }),
    getPaymentSettings(),
    priceLabelFor(order.product, order.planName),
  ]);

  const invoiceNumber = invoiceNumberFor(order.id, order.createdAt);
  const productLabel = order.product === "agent" ? "Agent WhatsApp" : "Metadata";
  const pdf = await buildInvoicePdf({
    invoiceNumber,
    issuedAt: order.createdAt,
    tenantName: user?.name || user?.email || "",
    businessName: user?.businessName ?? null,
    email: user?.email || "",
    productLabel,
    planName: order.planName,
    periodLabel: "Perpanjangan 1 bulan",
    priceLabel,
    bank,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
