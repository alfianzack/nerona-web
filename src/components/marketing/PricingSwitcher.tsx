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


export function PricingSwitcher({
  products,
}: {
  products: PricingProduct[];
  /**
   * Sisa dari alur berdurasi. Diterima tapi tidak dipakai supaya halaman yang
   * masih meneruskannya tidak patah — tidak ada lagi lencana diskon untuk
   * ditampilkan.
   */
  discounts?: Record<number, number>;
}) {
  const [active, setActive] = useState(products[0]?.key ?? "");
  const current = products.find((p) => p.key === active) ?? products[0];
  // Selalu tier "1 bulan": itu satu-satunya yang dijual sekarang.
  const tiers = current.tiersByDuration[1] ?? [];

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

      {/*
        Tab durasi DIBUANG. Sejak pembelian jadi sekali bayar tidak ada durasi
        untuk dipilih — menampilkannya berarti menawarkan pilihan yang tidak
        mengubah apa pun, dan itu lebih membingungkan daripada tidak ada.

        `tiersByDuration` dan `discounts` sengaja dibiarkan di props: keduanya
        masih dihitung server untuk order lama, dan membuangnya menyentuh
        rantai pemanggil yang jauh lebih panjang daripada nilainya hari ini.
      */}
      <p className="mt-3.5 text-center text-sm text-muted">{current.subheading}</p>
      <div className="mx-auto mt-11 max-w-5xl">
        <PricingTierGrid tiers={tiers} />
      </div>
    </div>
  );
}
