import Link from "next/link";

export interface PricingTierFeature {
  label: string;
  included: boolean;
}

export interface PricingTier {
  name: string;
  icon: string;
  tagline: string;
  priceLabel: string;
  features: PricingTierFeature[];
  cta: string;
  href: string;
  featured?: boolean;
}

function FeatureIcon({ included }: { included: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold ${
        included ? "bg-emerald-400/15 text-emerald-600" : "bg-rose-400/10 text-rose-500"
      }`}
      aria-hidden="true"
    >
      {included ? "✓" : "✕"}
    </span>
  );
}

export function PricingTierGrid({ tiers }: { tiers: PricingTier[] }) {
  return (
    <div className="grid grid-cols-1 items-start gap-7 sm:grid-cols-3">
      {tiers.map((tier) => (
        <div
          key={tier.name}
          className={`relative flex flex-col rounded-3xl bg-gradient-to-b from-surface to-surface2 p-7 shadow-2xl shadow-navy-900/10 ring-1 ${
            tier.featured
              ? "ring-2 ring-gold-400 sm:-translate-y-3 sm:shadow-gold-400/20"
              : "ring-navy-900/10"
          }`}
        >
          {tier.featured && (
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-1 text-[11px] font-extrabold tracking-wide text-navy-900">
              PALING POPULER
            </span>
          )}
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${
              tier.featured ? "bg-gradient-to-br from-gold-600 to-gold-400" : "bg-navy-900/5"
            }`}
            aria-hidden="true"
          >
            {tier.icon}
          </div>
          <h3 className="mt-4 text-lg font-extrabold text-ink">{tier.name}</h3>
          <p className="mt-0.5 text-xs text-muted">{tier.tagline}</p>
          <p className="mt-4 text-3xl font-extrabold text-[#3B65C4]">{tier.priceLabel}</p>
          <div className="my-5 h-px bg-navy-900/5" />
          <ul className="flex-1 space-y-2.5 text-[13px] text-ink">
            {tier.features.map((feature) => (
              <li key={feature.label} className="flex items-start gap-2.5">
                <FeatureIcon included={feature.included} />
                <span className={feature.included ? "" : "text-muted line-through"}>
                  {feature.label}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={tier.href}
            className={`mt-7 block rounded-full py-2.5 text-center text-[13px] font-bold transition ${
              tier.featured || tier.priceLabel !== "Rp 0"
                ? "bg-gradient-to-br from-gold-500 to-gold-400 text-navy-900 hover:brightness-110"
                : "bg-navy-900/5 text-ink ring-1 ring-navy-900/10 hover:bg-navy-900/10"
            }`}
          >
            {tier.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function PricingTiers({
  id,
  heading,
  subheading,
  tiers,
}: {
  id?: string;
  heading: string;
  subheading: string;
  tiers: PricingTier[];
}) {
  return (
    <section id={id} className="relative overflow-hidden bg-canvas px-6 py-24 sm:py-28">
      <div
        className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-gold-400 opacity-[0.12] blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-brand-blue opacity-30 blur-[100px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl">
        <h2 className="text-center text-sm font-bold uppercase tracking-[0.08em] text-brand-blue">
          {heading}
        </h2>
        <p className="mt-1 text-center text-sm text-muted">{subheading}</p>

        <div className="mt-12">
          <PricingTierGrid tiers={tiers} />
        </div>

        <p className="mt-10 text-center text-xs text-muted/80">
          Pembayaran diatur langsung dengan tim Nerona — pilih paket, kirim order, selesaikan
          pembayaran, dan akun Anda diaktifkan. Paket Free aktif seketika tanpa pembayaran.
        </p>
      </div>
    </section>
  );
}
