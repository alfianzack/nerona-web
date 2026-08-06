"use client";

import { useState } from "react";
import { PricingTierGrid, type PricingTier } from "./PricingTiers";

export interface PricingProduct {
  key: string;
  label: string;
  subheading: string;
  /** Tier per durasi (1 | 3 | 6 | 12), sudah dihitung di server. */
  tiersByDuration: Record<number, PricingTier[]>;
}

const ACTIVE_STYLES: Record<string, string> = {
  metadata: "bg-brand-blue/15 text-[#3B65C4]",
  agent: "bg-brand-orange/15 text-[#C25717]",
};

/** Label tombol durasi; hemat% ditempel di sini supaya alasan memilih terlihat. */
const DURATION_TABS: { months: number; label: string }[] = [
  { months: 1, label: "Bulanan" },
  { months: 3, label: "3 bulan" },
  { months: 6, label: "6 bulan" },
  { months: 12, label: "1 tahun" },
];

export function PricingSwitcher({
  products,
  discounts,
}: {
  products: PricingProduct[];
  /** Persen diskon per durasi, untuk lencana "hemat 10%". */
  discounts?: Record<number, number>;
}) {
  const [active, setActive] = useState(products[0]?.key ?? "");
  const [months, setMonths] = useState(1);
  const current = products.find((p) => p.key === active) ?? products[0];
  // Durasi yang tidak tersedia tidak boleh membuat grid kosong.
  const tiers = current.tiersByDuration[months] ?? current.tiersByDuration[1] ?? [];

  return (
    <div>
      {/* Satu produk = tidak ada yang bisa dipilih; tablist-nya disembunyikan.
          Tab durasi tetap, karena itu memang pilihan. */}
      {products.length > 1 && (
        <div className="flex justify-center">
          <div
            role="tablist"
            aria-label="Pilih produk"
            className="flex gap-1 rounded-full bg-surface p-1.5 shadow-md shadow-navy-900/5 ring-1 ring-navy-900/10"
          >
            {products.map((product) => (
              <button
                key={product.key}
                role="tab"
                aria-selected={active === product.key}
                onClick={() => setActive(product.key)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  active === product.key
                    ? ACTIVE_STYLES[product.key] ?? "bg-navy-900/10 text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {product.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`${products.length > 1 ? "mt-4 " : ""}flex justify-center`}>
        <div
          role="tablist"
          aria-label="Pilih durasi"
          className="flex flex-wrap justify-center gap-1 rounded-full bg-navy-900/[0.04] p-1.5 ring-1 ring-navy-900/10"
        >
          {DURATION_TABS.map((tab) => {
            const discount = discounts?.[tab.months] ?? 0;
            return (
              <button
                key={tab.months}
                role="tab"
                aria-selected={months === tab.months}
                onClick={() => setMonths(tab.months)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                  months === tab.months
                    ? "bg-surface text-ink shadow-sm ring-1 ring-navy-900/10"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                {discount > 0 && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    −{discount}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3.5 text-center text-sm text-muted">{current.subheading}</p>
      <div className="mx-auto mt-11 max-w-5xl">
        <PricingTierGrid tiers={tiers} />
      </div>
    </div>
  );
}
