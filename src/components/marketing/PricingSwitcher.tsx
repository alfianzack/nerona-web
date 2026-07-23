"use client";

import { useState } from "react";
import { PricingTierGrid, type PricingTier } from "./PricingTiers";

export interface PricingProduct {
  key: string;
  label: string;
  subheading: string;
  tiers: PricingTier[];
}

const ACTIVE_STYLES: Record<string, string> = {
  metadata: "bg-brand-blue/15 text-[#3B65C4]",
  agent: "bg-brand-orange/15 text-[#C25717]",
};

export function PricingSwitcher({ products }: { products: PricingProduct[] }) {
  const [active, setActive] = useState(products[0]?.key ?? "");
  const current = products.find((p) => p.key === active) ?? products[0];

  return (
    <div>
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
      <p className="mt-3.5 text-center text-sm text-muted">{current.subheading}</p>
      <div className="mx-auto mt-11 max-w-5xl">
        <PricingTierGrid tiers={current.tiers} />
      </div>
    </div>
  );
}
