import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { OrderForm } from "@/components/order/OrderForm";

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
        <h1 className="text-2xl font-semibold text-white">Pilih paket dulu</h1>
        <p className="mt-3 text-sm text-navy-300">
          Buka halaman produk dan pilih paket yang ingin Anda aktifkan.
        </p>
        <div className="mt-6 flex items-center justify-center gap-6 text-sm font-medium">
          <Link href="/metadata#pricing" className="text-gold-400 hover:underline">
            Harga Metadata ›
          </Link>
          <Link href="/agent#pricing" className="text-gold-400 hover:underline">
            Harga Agent ›
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16 sm:py-20">
      <h1 className="text-center text-2xl font-semibold text-white">Order</h1>
      <p className="mt-2 text-center text-sm text-navy-300">
        {tier.name === "Free"
          ? "Aktifkan paket Free Anda — tanpa pembayaran, langsung aktif."
          : "Satu langkah lagi — kirim order, lalu tim kami memandu pembayarannya."}
      </p>
      <div className="mt-8">
        <OrderForm
          product={product}
          planName={tier.name}
          priceLabel={tier.priceLabel}
          isFree={tier.name === "Free"}
        />
      </div>
    </main>
  );
}
