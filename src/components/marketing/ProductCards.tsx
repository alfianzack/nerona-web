import Link from "next/link";
import { Band } from "@/components/ui/Band";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

/**
 * Dua hal yang berubah di data ini, dan keduanya soal warna, bukan isi:
 *
 * 1. `icon` berhenti jadi emoji. 🖼️ dan 💬 dirender oleh sistem operasi, jadi
 *    bentuk dan bobotnya berbeda di tiap mesin dan tidak pernah mengikuti
 *    warna teks di sekitarnya.
 * 2. Pita samping berhenti bergradien, dan gradien Agent berhenti memakai emas.
 *    Emas adalah warna uang di dalam aplikasi; halaman publik hanya punya satu
 *    aksen. Yang tersisa satu bidang warna merek per produk — pengisi bentuk,
 *    bukan teks, jadi versi mentahnya aman dipakai.
 */
const PRODUCTS = [
  {
    href: "/metadata",
    icon: "image",
    title: "Nerona Metadata",
    body: "Judul, deskripsi, dan kata kunci dibuat otomatis dengan AI, langsung terisi ke formulir unggah Adobe Stock, Shutterstock, dan lainnya.",
    go: "Pelajari Metadata",
    stripe: "bg-brand-blue",
    chip: "bg-brand-blue/15",
    accent: "text-brand-blue-ink",
  },
  {
    href: "/agent",
    icon: "chat",
    title: "Nerona Agent",
    body: "Asisten AI pribadi yang chat langsung di WhatsApp — catat pesanan, cek stok, dan tanya omzet toko Anda kapan saja.",
    go: "Pelajari Agent",
    stripe: "bg-brand-orange",
    chip: "bg-brand-orange/15",
    accent: "text-brand-orange-ink",
  },
] as const;

export function ProductCards() {
  return (
    <Band>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {PRODUCTS.map((product) => (
          /* Angkatan setengah piksel saat disentuh dipertahankan — itu satu-
             satunya isyarat bahwa kartunya bisa diklik sejak bayangannya
             dilepas. Bayangan hover-nya sendiri ikut hilang: kartu diam tidak
             berbayang, jadi kartu tersentuh juga tidak. */
          <Link
            key={product.href}
            href={product.href}
            className="block transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <Card padding="lg" className="relative h-full overflow-hidden">
              <span
                className={`absolute inset-y-0 left-0 w-1.5 ${product.stripe}`}
                aria-hidden="true"
              />
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-card ${product.chip} ${product.accent}`}
              >
                <Icon name={product.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-title-2 text-ink">{product.title}</h3>
              <p className="mt-2 text-body-lg text-muted">{product.body}</p>
              {/* Panah sebagai ikon, bukan glyph teks. Alasannya sama dengan
                  emoji yang sudah dibuang dari berkas ini: glyph dirender font
                  sistem, ukurannya tidak bisa disetel, dan warnanya tidak ikut
                  teks di sekitarnya. */}
              <span
                className={`mt-4 inline-flex items-center gap-1.5 text-body font-semibold ${product.accent}`}
              >
                {product.go}
                <Icon name="arrow-right" className="h-4 w-4" />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </Band>
  );
}
