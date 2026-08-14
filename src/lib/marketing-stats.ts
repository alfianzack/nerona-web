import { prisma } from "./prisma";

/**
 * Angka traksi untuk halaman pemasaran — dan gerbang yang menahannya.
 *
 * Halaman jualan sejenis memajang "2.000+ kontributor" dan "15 juta+ kata
 * kunci". Nerona bisa ikut, tapi hanya dengan angka yang benar-benar bisa
 * dibuktikan dari basis datanya sendiri; itu aturan yang sudah berlaku di repo
 * ini (lihat spec marketing-honesty dan komentar di lib/marketplaces.ts).
 *
 * Yang TIDAK ada di sini, dan sebabnya:
 *
 * - Jumlah pelanggan berbayar. Berapa pun nilainya, memajangnya memberi tahu
 *   pesaing ukuran bisnis Anda, dan karena ia pasti lebih kecil dari jumlah
 *   pendaftar, ia justru menonjolkan rasio konversi. Halaman jualan tidak
 *   pernah untung dari angka ini.
 * - Jumlah pengguna terdaftar. Hitungan mentahnya menggelembung — akun belum
 *   verifikasi, akun admin, akun uji semuanya ikut. Menyaringnya butuh query
 *   di kolom tanpa index, dan hasilnya tetap angka yang paling lemah dari
 *   ketiganya.
 * - Testimoni. Tidak ada model, kolom, maupun endpoint untuk itu di seluruh
 *   skema. Menampilkannya hari ini berarti mengarangnya.
 */

/**
 * Ambang di mana sebuah angka mulai membantu alih-alih merugikan.
 *
 * Angka kecil bukan netral. "412 metadata" mengubah halaman dari "produk" jadi
 * "eksperimen", dan memberi keraguan kepada pengunjung yang tadinya tidak
 * punya. Di bawah ambang, seluruh barisnya tidak dirender sama sekali — bukan
 * ditampilkan kecil-kecil — lalu menyala sendiri begitu datanya cukup besar,
 * tanpa perlu ada yang mengubah kode.
 */
const AMBANG = {
  metadata: 10_000,
  keywords: 250_000,
} as const;

export interface MarketingStats {
  metadata: number;
  keywords: number;
}

/**
 * Null berarti "jangan render barisnya sama sekali".
 *
 * Kedua angka lolos bersama atau tidak sama sekali. Menampilkan salah satunya
 * saja mengundang pembaca membagi sendiri dan menemukan basis yang kecil: 15
 * juta kata kunci dari 900 metadata adalah aritmetika yang merusak, bukan
 * membangun.
 */
export async function getMarketingStats(): Promise<MarketingStats | null> {
  // Dua query terpisah, bukan getMetadataLogStats(): fungsi itu ikut menghitung
  // 7 hari terakhir dan mengelompokkan per marketplace — dua pekerjaan yang
  // terbuang untuk halaman yang cuma butuh dua angka.
  const [metadata, agregat] = await Promise.all([
    prisma.metadataLog.count(),
    prisma.metadataLog.aggregate({ _sum: { keywordCount: true } }),
  ]);

  const keywords = agregat._sum.keywordCount ?? 0;

  if (metadata < AMBANG.metadata || keywords < AMBANG.keywords) return null;

  return { metadata, keywords };
}

/**
 * Dibulatkan ke bawah, tidak pernah ke atas.
 *
 * 12.480 jadi "12.000+", bukan "12.500". Arah pembulatannya sengaja searah
 * dengan kebijakan under-claim di lib/marketplaces.ts: kalau salah, lebih baik
 * salah karena terlalu sedikit.
 *
 * Pembulatannya juga menutupi satu sifat yang mengganggu dari angka ini —
 * MetadataLog memakai cascade delete, jadi menghapus satu akun ikut menghapus
 * riwayatnya dan angkanya bisa TURUN. Pada langkah seribu, penurunan sekecil
 * itu tidak pernah terlihat pengunjung.
 */
export function bulatkanKeBawah(nilai: number): string {
  if (nilai >= 1_000_000) {
    const juta = Math.floor(nilai / 100_000) / 10;
    return `${juta.toLocaleString("id-ID")} juta+`;
  }
  if (nilai >= 1_000) {
    return `${(Math.floor(nilai / 1_000) * 1_000).toLocaleString("id-ID")}+`;
  }
  return nilai.toLocaleString("id-ID");
}
