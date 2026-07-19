import Link from "next/link";
import { MetadataCardMockup } from "./mockups/MetadataCardMockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-950 px-6 pb-24 pt-20 text-center sm:pt-28">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gold-400 opacity-[0.08] blur-[110px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-4xl">
        <p className="text-sm font-medium text-gold-400">Ekstensi Chrome Nerona Metadata</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white sm:text-7xl">
          Metadata untuk kontributor stock,{" "}
          <span className="bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300 bg-clip-text text-transparent">
            ditulis otomatis.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-navy-300 sm:text-xl">
          Nerona membuat judul, deskripsi, dan kata kunci dengan AI, lalu mengisinya langsung ke
          formulir unggah marketplace Anda.
        </p>
        <div className="mt-8 flex items-center justify-center gap-6">
          <Link
            href="#pricing"
            className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-semibold text-navy-900 transition hover:brightness-110"
          >
            Lihat Harga
          </Link>
          <Link
            href="/learn"
            className="text-sm font-medium text-gold-400 transition hover:underline"
          >
            Pelajari caranya <span aria-hidden="true">›</span>
          </Link>
        </div>
        <div className="mx-auto mt-16 max-w-lg">
          <MetadataCardMockup />
        </div>
      </div>
    </section>
  );
}
