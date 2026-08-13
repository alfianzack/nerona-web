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

/**
 * Warna tab aktif per produk. Keduanya dulu hex lepas (#3B65C4 dan #C25717) —
 * kini token, dan yang dipakai untuk teks selalu varian -ink karena warna merek
 * mentah gagal uji kontras di atas putih.
 */
const ACTIVE_STYLES: Record<string, string> = {
  metadata: "bg-brand-blue/10 text-brand-blue-ink",
  agent: "bg-brand-orange/10 text-brand-orange-ink",
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
          {/* `rounded-action` bukan `rounded-full`: komponen ini juga dipakai di
              /paket, dan di dalam aplikasi bentuk pil bukan bahasa yang benar. */}
          <div
            role="tablist"
            aria-label="Pilih produk"
            className="flex gap-1 rounded-action bg-surface p-1.5 ring-1 ring-border"
          >
            {products.map((product) => (
              <button
                key={product.key}
                role="tab"
                aria-selected={active === product.key}
                onClick={() => setActive(product.key)}
                className={`rounded-action px-5 py-2 text-body font-semibold transition ${
                  active === product.key
                    ? ACTIVE_STYLES[product.key] ?? "bg-surface-sunken text-ink"
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
      {/* Jaraknya menyusul tablist, jadi ia hanya ada kalau tablist-nya ada —
          kalau tidak, baris ini yang paling atas dan jaraknya milik pemanggil. */}
      <p
        className={`mx-auto max-w-[52ch] text-center text-body-lg text-muted ${
          products.length > 1 ? "mt-5" : ""
        }`}
      >
        {current.subheading}
      </p>
      {/* `text-left` eksplisit: pemanggil di halaman harga adalah pita yang rata
          tengah, dan daftar fitur yang ikut rata tengah tidak bisa dibaca. */}
      <div className="mx-auto mt-12 max-w-band text-left">
        <PricingTierGrid tiers={tiers} />
      </div>
    </div>
  );
}
