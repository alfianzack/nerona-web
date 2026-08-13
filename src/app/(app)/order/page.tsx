import { requireUser } from "@/lib/session-guards";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";
import { coerceDuration } from "@/lib/plan-duration";
import { AGENT_ENABLED } from "@/lib/features";
import { amountForOrder, gatewayEnabled } from "@/lib/payments/orders";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextLink } from "@/components/ui/TextLink";
import { Icon } from "@/components/ui/icons";
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
      <main className="mx-auto max-w-xl px-6 py-band">
        <PageHeader
          title="Pilih paket dulu"
          description="Buka halaman Harga dan pilih paket yang ingin Anda aktifkan."
        />
        <div className="mt-6">
          {/* Kurung sudutnya datang dari TextLink sendiri, jadi tidak ditulis
              lagi di sini. */}
          <TextLink href="/pricing">Lihat Harga</TextLink>
        </div>
      </main>
    );
  }

  const isFree = tier.name === "Free";

  return (
    <main className="mx-auto max-w-3xl px-6 py-band">
      <ButtonLink href="/pricing" variant="ghost" size="sm" className="-ml-3">
        <Icon name="arrow-left" className="h-3.5 w-3.5" />
        Kembali ke Harga
      </ButtonLink>
      {/* Judulnya sempat berbahasa Inggris di cabang berbayar — satu-satunya
          kebocoran bahasa di corong pembayaran. */}
      <PageHeader
        className="mt-3"
        title={isFree ? "Aktifkan paket" : "Atur paket Anda"}
        description={
          isFree
            ? "Paket Free — tanpa pembayaran, langsung aktif."
            : "Pilih metode pembayaran, lalu selesaikan transfer di langkah berikutnya."
        }
      />

      <div className="mt-8">
        {isFree ? (
          <FreeActivateCard product={product} planName={tier.name} />
        ) : (
          <CheckoutView
            product={product}
            planName={tier.name}
            priceLabel={tier.priceLabel}
            poinAwal={tier.poinAwal ?? null}
            features={tier.features}
            // Dua syarat, dan keduanya diperiksa DI SINI supaya pilihan yang
            // pasti gagal tidak pernah sampai ke layar: saklarnya menyala, dan
            // paketnya punya harga angka (paket "Hubungi kami" tidak bisa
            // ditagih otomatis).
            qrisTersedia={
              (await gatewayEnabled()) &&
              (await amountForOrder({
                product,
                planName: tier.name,
                durationMonths: 1,
                priceAmount: null,
              })) !== null
            }
          />
        )}
      </div>
    </main>
  );
}
