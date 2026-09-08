import type { Metadata } from "next";

import { FaqSection } from "@/components/marketing/FaqSection";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { metadataFaq } from "@/lib/marketing-faq";
import { defaultModelPointsPerImage } from "@/lib/marketing-points";

export const metadata: Metadata = {
  title: "Pertanyaan umum — Nerona Metadata",
  description:
    "Jawaban lengkap soal poin, bahasa metadata, jumlah kata kunci, privasi gambar, pemasangan ekstensi, pembayaran, dan pengembalian dana.",
};

/**
 * Daftar PENUH, termasuk enam yang juga tampil di beranda.
 *
 * Sengaja tidak menyembunyikan yang enam itu: orang yang sampai ke halaman ini
 * datang dari tautan "Semua pertanyaan", dan daftar yang justru kehilangan
 * pertanyaan paling umum terbaca sebagai halaman yang rusak — bukan sebagai
 * halaman yang rapi.
 *
 * Patokan poinnya dihitung ulang di sini, bukan diambil dari beranda: kedua
 * halaman berdiri sendiri, dan menyalin angkanya berarti satu dari keduanya
 * akan basi. Ongkosnya satu kueri di halaman yang jarang dibuka.
 */
export default async function FaqPage() {
  const poinPerGambar = await defaultModelPointsPerImage();

  return (
    <main>
      <FaqSection items={metadataFaq({ poinPerGambar })} />
      <CtaBanner
        title="Coba gratis hari ini"
        body="Poin percobaan sekali per akun — cukup untuk menilai hasilnya sebelum Anda memutuskan."
        ctaLabel="Coba gratis"
        ctaHref="/register"
      />
    </main>
  );
}
