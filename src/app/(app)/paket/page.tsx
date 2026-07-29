import { requireUser } from "@/lib/session-guards";
import { getBalance } from "@/lib/points";
import { PricingSwitcher } from "@/components/marketing/PricingSwitcher";
import { agentTiers, metadataTiers } from "@/lib/pricing-tiers";

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
  const [tiers, balance] = await Promise.all([
    metadataTiers(),
    getBalance(session.user.id),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Paket & Harga</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-3.5 py-1.5 text-sm font-semibold text-[#9A6B08] ring-1 ring-gold-400/40">
            {balance.toLocaleString("id-ID")} poin
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Pilih paket untuk membeli atau memperpanjang. Riwayat pembayaran ada di Finance.
        </p>

        <div className="mt-10">
          <PricingSwitcher
            products={[
              {
                key: "metadata",
                label: "🖼️ Metadata",
                subheading: "Metadata otomatis untuk kontributor stock.",
                tiers,
              },
              {
                key: "agent",
                label: "💬 Agent",
                subheading: "Asisten AI WhatsApp untuk pemilik bisnis.",
                tiers: agentTiers(),
              },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
