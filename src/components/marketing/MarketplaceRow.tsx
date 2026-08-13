import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { Band } from "@/components/ui/Band";

export function MarketplaceRow() {
  return (
    <Band align="center">
      {/* Baris pengantar deretan nama: label mono kecil, bentuk yang dipakai
          skala tipografi untuk eyebrow. */}
      <p className="font-mono text-label uppercase text-muted">
        Bekerja di marketplace tempat Anda mengunggah
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
        {CLAIMABLE_MARKETPLACES.map((marketplace) => (
          <span
            key={marketplace.key}
            className="text-body-lg font-semibold text-muted transition hover:text-accent"
          >
            {marketplace.label}
          </span>
        ))}
      </div>
    </Band>
  );
}
