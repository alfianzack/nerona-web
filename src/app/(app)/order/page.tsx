import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { coerceDuration, DURATION_LABELS } from "@/lib/plan-duration";
import { AGENT_ENABLED } from "@/lib/features";
import { CheckoutView } from "@/components/order/CheckoutView";
import { FreeActivateCard } from "@/components/order/FreeActivateCard";

export default async function OrderPage({
  searchParams,
}: {
  searchParams: { product?: string; plan?: string; months?: string };
}) {
  await requireUser();

  const product = searchParams.product;
  const planName = searchParams.plan;
  // Durasi datang dari URL, jadi tidak bisa dipercaya — coerceDuration memaksa
  // apa pun yang aneh kembali ke 1 bulan, bukan melempar.
  const months = coerceDuration(searchParams.months);

  // Order agent baru ditolak selama produknya disembunyikan; URL agent jatuh
  // ke cabang "Pilih paket dulu" di bawah, sama seperti produk tak dikenal.
  const agentOrderable = product === "agent" && AGENT_ENABLED;
  const tiers =
    product === "metadata"
      ? await metadataTiers(months)
      : agentOrderable
        ? await agentTiers(months)
        : null;
  const tier = tiers?.find((candidate) => candidate.name === planName);

  if (!tier || (product !== "metadata" && !agentOrderable)) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-ink">Pilih paket dulu</h1>
        <p className="mt-3 text-sm text-muted">
          Buka halaman Harga dan pilih paket yang ingin Anda aktifkan.
        </p>
        <div className="mt-6">
          <Link href="/pricing" className="text-brand-blue hover:underline">
            Lihat Harga ›
          </Link>
        </div>
      </main>
    );
  }

  const isFree = tier.name === "Free";

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
      <Link href="/pricing" className="text-sm text-brand-blue hover:underline">
        ‹ Kembali ke Harga
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {isFree ? "Aktifkan paket" : "Configure your plan"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {isFree
          ? "Paket Free — tanpa pembayaran, langsung aktif."
          : "Pilih metode pembayaran, lalu selesaikan transfer di langkah berikutnya."}
      </p>

      <div className="mt-8">
        {isFree ? (
          <FreeActivateCard product={product} planName={tier.name} />
        ) : (
          <CheckoutView
            product={product}
            planName={tier.name}
            durationMonths={months}
            durationLabel={DURATION_LABELS[months] ?? `${months} bulan`}
            priceLabel={tier.priceLabel}
            savingsLabel={tier.savingsLabel ?? null}
            features={tier.features}
          />
        )}
      </div>
    </main>
  );
}
