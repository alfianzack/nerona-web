import { MARKETPLACES } from "@/lib/marketplaces";

export function MarketplaceRow() {
  return (
    <section className="bg-canvas px-6 py-20 text-center">
      <p className="text-sm font-medium text-muted">
        Bekerja di marketplace tempat Anda mengunggah
      </p>
      <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-5">
        {MARKETPLACES.map((marketplace) => (
          <span
            key={marketplace.key}
            className="text-lg font-semibold tracking-tight text-muted/70 transition hover:text-brand-blue"
          >
            {marketplace.label}
          </span>
        ))}
      </div>
    </section>
  );
}
