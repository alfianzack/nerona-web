import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session-guards";
import { getUserOrder } from "@/lib/orders";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { getPaymentSettings, isPaymentConfigured } from "@/lib/payment-settings";
import { PaymentProofUpload } from "@/components/order/PaymentProofUpload";

function statusBanner(status: string, hasProof: boolean) {
  if (status === "fulfilled") {
    return { text: "Paket aktif — terima kasih!", tone: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20" };
  }
  if (status === "cancelled") {
    return { text: "Order dibatalkan.", tone: "bg-rose-500/10 text-rose-600 ring-rose-500/20" };
  }
  if (hasProof) {
    return {
      text: "Bukti transfer terkirim — menunggu verifikasi admin.",
      tone: "bg-brand-blue/10 text-brand-blue ring-brand-blue/20",
    };
  }
  return {
    text: "Menunggu pembayaran. Transfer ke rekening di bawah, lalu unggah buktinya.",
    tone: "bg-gold-400/15 text-gold-600 ring-gold-400/30",
  };
}

async function priceFor(product: string, planName: string): Promise<string> {
  const tiers = product === "metadata" ? await metadataTiers() : agentTiers();
  return tiers.find((t) => t.name === planName)?.priceLabel ?? "Hubungi admin";
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await requireUser();
  const order = await getUserOrder(session.user.id, params.id);
  if (!order) {
    notFound();
  }

  const [price, bank] = await Promise.all([
    priceFor(order.product, order.planName),
    getPaymentSettings(),
  ]);

  const hasProof = Boolean(order.proofUploadedAt);
  const banner = statusBanner(order.status, hasProof);
  const isPending = order.status === "pending";
  const bankReady = isPaymentConfigured(bank);

  return (
    <main className="mx-auto max-w-2xl px-6 py-14 sm:py-16">
      <Link href="/transaksi" className="text-sm text-brand-blue hover:underline">
        ‹ Semua transaksi
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {order.product === "metadata" ? "Nerona Metadata" : "Nerona Agent"} — {order.planName}
      </h1>

      <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${banner.tone}`}>
        {banner.text}
      </div>

      {isPending && (
        <a
          href={`/api/orders/${order.id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
        >
          Unduh invoice (PDF) ↗
        </a>
      )}

      {isPending && (
        <section className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Detail transfer
          </h2>
          {bankReady ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Bank</dt>
                <dd className="font-medium text-ink">{bank.bankName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nomor rekening</dt>
                <dd className="rounded-lg bg-navy-900/5 px-2.5 py-1 font-mono text-ink ring-1 ring-navy-900/10">
                  {bank.accountNumber}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Atas nama</dt>
                <dd className="font-medium text-ink">{bank.accountHolder}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-navy-900/10 pt-3">
                <dt className="text-muted">Jumlah transfer</dt>
                <dd className="text-lg font-extrabold text-brand-blue">{price}</dd>
              </div>
              {bank.instructions && (
                <p className="border-t border-navy-900/10 pt-3 text-xs text-muted">
                  {bank.instructions}
                </p>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Rekening pembayaran belum diatur. Silakan hubungi admin Nerona.
            </p>
          )}
        </section>
      )}

      <section className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Bukti pembayaran
        </h2>
        <div className="mt-3">
          {isPending ? (
            <PaymentProofUpload orderId={order.id} hasProof={hasProof} />
          ) : hasProof ? (
            <PaymentProofUpload orderId={order.id} hasProof disabled />
          ) : (
            <p className="text-sm text-muted">Tidak ada bukti pembayaran.</p>
          )}
        </div>
      </section>
    </main>
  );
}
