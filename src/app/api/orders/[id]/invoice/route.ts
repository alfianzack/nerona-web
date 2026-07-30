import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserOrder } from "@/lib/orders";
import { getPaymentSettings } from "@/lib/payment-settings";
import { buildInvoicePdf, invoiceNumberFor, priceLabelFor } from "@/lib/billing/invoice";
import { DURATION_LABELS } from "@/lib/plan-duration";
import { formatRupiah } from "@/lib/money";

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
    order.product === "points"
      ? Promise.resolve(order.priceAmount === null ? "Hubungi admin" : formatRupiah(order.priceAmount))
      : priceLabelFor(order.product, order.planName, order.durationMonths),
  ]);

  const invoiceNumber = invoiceNumberFor(order.id, order.createdAt);
  const productLabel =
    order.product === "points"
      ? "Top-up poin"
      : order.product === "agent"
        ? "Agent WhatsApp"
        : "Metadata";
  const pdf = await buildInvoicePdf({
    invoiceNumber,
    issuedAt: order.createdAt,
    tenantName: user?.name || user?.email || "",
    businessName: user?.businessName ?? null,
    email: user?.email || "",
    productLabel,
    planName: order.planName,
    periodLabel:
      order.product === "points"
        ? "Pembelian poin — tidak ada masa berlaku"
        : `${order.isRenewal ? "Perpanjangan" : "Aktivasi"} ${
            DURATION_LABELS[order.durationMonths] ?? `${order.durationMonths} bulan`
          }`,
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
