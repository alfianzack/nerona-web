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
        included ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-400/10 text-rose-400"
      }`}
      aria-hidden="true"
    >
      {included ? "✓" : "✕"}
    </span>
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
    <section id={id} className="relative overflow-hidden bg-navy-950 px-6 py-24 sm:py-28">
      <div
        className="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-gold-400 opacity-[0.12] blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-navy-500 opacity-30 blur-[100px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl">
        <h2 className="text-center text-sm font-bold uppercase tracking-[0.08em] text-gold-400">
          {heading}
        </h2>
        <p className="mt-1 text-center text-sm text-navy-300">{subheading}</p>

        <div className="mt-12 grid grid-cols-1 items-start gap-7 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-7 shadow-2xl shadow-black/50 ring-1 ${
                tier.featured
                  ? "ring-gold-400 sm:-translate-y-3 sm:shadow-gold-400/10"
                  : "ring-white/10"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-1 text-[11px] font-extrabold tracking-wide text-navy-900">
                  PALING POPULER
                </span>
              )}
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${
                  tier.featured
                    ? "bg-gradient-to-br from-gold-600 to-gold-400"
                    : "bg-white/10"
                }`}
                aria-hidden="true"
              >
                {tier.icon}
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-white">{tier.name}</h3>
              <p className="mt-0.5 text-xs text-navy-300">{tier.tagline}</p>
              <p className="mt-4 text-3xl font-extrabold text-gold-400">{tier.priceLabel}</p>
              <div className="my-5 h-px bg-white/10" />
              <ul className="flex-1 space-y-2.5 text-[13px] text-navy-100">
                {tier.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2.5">
                    <FeatureIcon included={feature.included} />
                    <span className={feature.included ? "" : "text-navy-300 line-through"}>
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
                    : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-navy-300/80">
          Pembayaran diatur langsung dengan tim Nerona — pilih paket, kirim order, selesaikan
          pembayaran, dan akun Anda diaktifkan. Paket Free aktif seketika tanpa pembayaran.
        </p>
      </div>
    </section>
  );
}
