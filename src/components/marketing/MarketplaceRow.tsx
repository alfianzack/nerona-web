import { MARKETPLACES } from "@/lib/marketplaces";

export function MarketplaceRow() {
  return (
    <section className="bg-navy-950 px-6 py-20 text-center">
      <p className="text-sm font-medium text-navy-300">
        Bekerja di marketplace tempat Anda mengunggah
      </p>
      <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-5">
        {MARKETPLACES.map((marketplace) => (
          <span
            key={marketplace.key}
            className="text-lg font-semibold tracking-tight text-navy-300/70 transition hover:text-gold-400"
          >
            {marketplace.label}
          </span>
        ))}
      </div>
    </section>
  );
}
