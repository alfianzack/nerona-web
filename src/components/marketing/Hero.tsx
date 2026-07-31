import Link from "next/link";
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";
import { MetadataCardMockup } from "./mockups/MetadataCardMockup";

/**
 * Angka-angka di baris kepercayaan diambil dari registry dan default kode,
 * bukan ditulis tangan — supaya tidak bisa melenceng dari yang sebenarnya
 * diberikan. Kalau owner menimpa poin Free di Pengaturan, kalimat ini ikut
 * salah; itu tradeoff yang sama dengan halaman-halaman marketing lain.
 */
const HERO_FACTS = [
  `${CLAIMABLE_MARKETPLACES.length} marketplace didukung`,
  "Tanpa kartu kredit",
  `${DEFAULT_PLAN_POINTS.metadata.free} poin gratis untuk mencoba`,
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-canvas px-6 pb-24 pt-20 text-center sm:pt-28">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold-400 opacity-[0.08] blur-[110px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-4xl">
        <p className="text-sm font-medium text-brand-blue">Ekstensi Chrome Nerona Metadata</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight text-ink sm:text-7xl">
          Metadata untuk kontributor stock,{" "}
          <span className="bg-gradient-to-r from-brand-blue via-brand-orange to-brand-orange bg-clip-text text-transparent">
            ditulis otomatis.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">
          Nerona membuat judul, deskripsi, dan kata kunci dengan AI, lalu mengisinya langsung ke
          formulir unggah marketplace Anda.
        </p>
        {/* Halaman jualan meminta pendaftaran lebih dulu; harga jadi pilihan
            kedua. Sebelumnya "Lihat Harga" adalah satu-satunya tombol, yang
            menggeser orang ke tabel harga sebelum mereka punya alasan. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/register"
            className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-lg shadow-gold-500/30 transition hover:brightness-110"
          >
            Mulai gratis
          </Link>
          <Link
            href="#pricing"
            className="rounded-full bg-surface px-6 py-2.5 text-sm font-medium text-ink ring-1 ring-navy-900/15 transition hover:bg-surface2"
          >
            Lihat harga
          </Link>
          {/* Learn is temporarily hidden — uncomment to re-enable (also remove the /learn redirect in next.config.mjs)
          <Link
            href="/learn"
            className="text-sm font-medium text-brand-blue transition hover:underline"
          >
            Pelajari caranya <span aria-hidden="true">›</span>
          </Link>
          */}
        </div>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] text-muted">
          {HERO_FACTS.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-1.5">
              <span className="font-bold text-emerald-600" aria-hidden="true">
                ✓
              </span>
              {fact}
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-16 max-w-lg">
          <MetadataCardMockup />
        </div>
      </div>
    </section>
  );
}
