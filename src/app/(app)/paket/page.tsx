import { requireUser } from "@/lib/session-guards";
import { getBalance } from "@/lib/points";
import { PricingSwitcher } from "@/components/marketing/PricingSwitcher";
import { pricingProducts } from "@/lib/pricing-products";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Paket & Harga — Nerona" };

// The tenant-facing purchase surface, inside the app shell. PricingSwitcher is
// a pure client component whose only prop is `products`, so this reuses it
// against the same lib/pricing-tiers data as /pricing with nothing duplicated.
//
// Deliberately not carried over from /pricing: the hero, StepsSection,
// FaqSection, and CtaBanner — that banner's CTA is "Buat akun gratis", which is
// meaningless for someone already signed in.
export default async function PaketPage() {
  const session = await requireUser();
  const [{ products, discounts }, balance] = await Promise.all([
    pricingProducts(),
    getBalance(session.user.id),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-band">
        {/* Saldo poin ikut di kepala halaman karena inilah layar tempat orang
            memutuskan membeli — angkanya bagian dari keputusan itu. */}
        <PageHeader
          title="Paket & Harga"
          description="Pilih paket untuk membeli atau memperpanjang. Riwayat pembayaran ada di Finance."
          actions={<Badge tone="points">{balance.toLocaleString("id-ID")} poin</Badge>}
        />

        <div className="mt-10">
          <PricingSwitcher products={products} discounts={discounts} />
        </div>
      </div>
    </main>
  );
}
