import { prisma } from "@/lib/prisma";
import { getPaymentSettings } from "@/lib/payment-settings";
import { buildInvoicePdf, invoiceNumberFor, priceLabelFor } from "@/lib/billing/invoice";
import { sendRenewalInvoiceEmail } from "@/lib/mail";
import { coerceDuration, DURATION_LABELS } from "@/lib/plan-duration";
import { AGENT_ENABLED } from "@/lib/features";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_PLANS = ["pro", "business"];

function title(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

async function hasPending(userId: string, product: "agent" | "metadata"): Promise<boolean> {
  const n = await prisma.orderRequest.count({ where: { userId, product, status: "pending" } });
  return n > 0;
}

type RenewalUser = { email: string; name: string | null; businessName: string | null };

async function emailInvoice(
  req: { id: string; createdAt: Date },
  user: RenewalUser,
  product: "agent" | "metadata",
  planName: string,
  months: number
): Promise<void> {
  try {
    const [bank, priceLabel] = await Promise.all([
      getPaymentSettings(),
      priceLabelFor(product, planName, months),
    ]);
    const productLabel = product === "agent" ? "Agent WhatsApp" : "Metadata";
    const invoiceNumber = invoiceNumberFor(req.id, req.createdAt);
    const tenantName = user.name || user.email;
    const pdf = await buildInvoicePdf({
      invoiceNumber,
      issuedAt: req.createdAt,
      tenantName,
      businessName: user.businessName,
      email: user.email,
      productLabel,
      planName,
      periodLabel: `Perpanjangan ${DURATION_LABELS[months] ?? `${months} bulan`}`,
      priceLabel,
      bank,
    });
    await sendRenewalInvoiceEmail(user.email, { tenantName, productLabel, planName, priceLabel, invoiceNumber, pdf });
  } catch (err) {
    console.error("[renewals] invoice/email failed", err);
  }
}

// Auto-create pending renewal OrderRequests for subscriptions expiring within
// `leadDays` (or already lapsed). Idempotent: skips users who already have a
// pending request for that product. `planExpiresAt/validUntil: { lte }` excludes
// nulls, so free/never-expiring rows are ignored.
export async function generateDueRenewals(
  now: Date = new Date(),
  leadDays = 7
): Promise<{ created: number }> {
  const cutoff = new Date(now.getTime() + leadDays * DAY_MS);
  let created = 0;

  // Selama Agent disembunyikan, perpanjangannya tidak dibuat sama sekali:
  // banner "Perpanjangan jatuh tempo" di /finance akan menyebut produk yang
  // sudah tidak ada di UI mana pun. Konsekuensinya disengaja — paket Agent
  // yang berjalan akan habis masa aktifnya lalu tidak diperpanjang.
  if (AGENT_ENABLED) {
    const profiles = await prisma.agentProfile.findMany({
      where: { status: "active", plan: { in: PAID_PLANS }, planExpiresAt: { lte: cutoff } },
      select: {
        userId: true,
        plan: true,
        // Perpanjangan mengikuti durasi yang dibeli: paket 6 bulan ditagih 6 bulan
        // lagi, bukan turun diam-diam ke bulanan.
        planDurationMonths: true,
        user: { select: { email: true, name: true, businessName: true } },
      },
    });
    for (const p of profiles) {
      if (await hasPending(p.userId, "agent")) continue;
      const months = coerceDuration(p.planDurationMonths);
      const req = await prisma.orderRequest.create({
        data: {
          userId: p.userId,
          product: "agent",
          planName: title(p.plan),
          durationMonths: months,
          isRenewal: true,
        },
      });
      created++;
      await emailInvoice(req, p.user, "agent", title(p.plan), months);
    }
  }

  const licenses = await prisma.license.findMany({
    where: { status: { in: ["active", "comp"] }, validUntil: { lte: cutoff } },
    select: {
      userId: true,
      durationMonths: true,
      plan: { select: { name: true } },
      user: { select: { email: true, name: true, businessName: true } },
    },
  });
  for (const l of licenses) {
    if (!l.plan?.name) continue;
    if (await hasPending(l.userId, "metadata")) continue;
    const months = coerceDuration(l.durationMonths);
    const req = await prisma.orderRequest.create({
      data: {
        userId: l.userId,
        product: "metadata",
        planName: l.plan.name,
        durationMonths: months,
        isRenewal: true,
      },
    });
    created++;
    await emailInvoice(req, l.user, "metadata", l.plan.name, months);
  }

  return { created };
}
