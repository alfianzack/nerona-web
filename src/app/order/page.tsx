import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { CheckoutView } from "@/components/order/CheckoutView";
import { FreeActivateCard } from "@/components/order/FreeActivateCard";

export default async function OrderPage({
  searchParams,
}: {
  searchParams: { product?: string; plan?: string };
}) {
  await requireUser();

  const product = searchParams.product;
  const planName = searchParams.plan;

  const tiers =
    product === "metadata" ? await metadataTiers() : product === "agent" ? agentTiers() : null;
  const tier = tiers?.find((candidate) => candidate.name === planName);

  if (!tier || (product !== "metadata" && product !== "agent")) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-ink">Pilih paket dulu</h1>
        <p className="mt-3 text-sm text-muted">
          Buka halaman Produk dan pilih paket yang ingin Anda aktifkan.
        </p>
        <div className="mt-6">
          <Link href="/produk" className="text-brand-blue hover:underline">
            Buka Produk ›
          </Link>
        </div>
      </main>
    );
  }

  const isFree = tier.name === "Free";

  return (
    <main className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
      <Link href="/produk" className="text-sm text-brand-blue hover:underline">
        ‹ Kembali ke Produk
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
            priceLabel={tier.priceLabel}
            features={tier.features}
          />
        )}
      </div>
    </main>
  );
}
