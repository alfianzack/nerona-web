import { prisma } from "@/lib/prisma";

/**
 * Penjaga duplikat (fitur B).
 *
 * Sidiknya dHash 64 bit yang dihitung di browser (nerona_medata/guard/sidik.js);
 * di sini ia cuma dibandingkan. Jarak Hamming-nya kembaran dari berkas itu:
 * tanpa bundler, satu berkas bersama tidak mungkin, jadi yang menjaga keduanya
 * sejalan adalah dua berkas uji yang memaku angka yang sama.
 *
 * Pencariannya sengaja di memori, bukan di SQL. Postgres tidak punya jarak
 * Hamming atas teks heks tanpa ekstensi, dan menirunya lewat SQL berarti
 * ekspresi panjang yang tidak bisa memakai indeks. Menarik 2.000 sidik terbaru
 * milik satu kontributor lalu membandingkannya di memori jauh lebih murah, dan
 * bisa diuji.
 */

/**
 * Batas riwayat yang ikut dibandingkan. Dua ribu perbandingan 64 bit selesai
 * dalam hitungan milidetik; menarik seluruh riwayat kontributor lama tidak, dan
 * duplikat yang berarti hampir selalu ada di kiriman terakhir.
 */
export const BATAS_RIWAYAT_BANDING = 2000;

const HEKS = /^[0-9a-f]+$/;
const JUMLAH_BIT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export interface BarisSidik {
  id: string;
  title: string;
  marketplace: string;
  createdAt: Date;
  imageHash: string | null;
}

export interface Duplikat {
  id: string;
  title: string;
  marketplace: string;
  createdAt: Date;
  jarak: number;
}

/** null berarti "tidak bisa dibandingkan", dan itu BUKAN sama dengan "mirip". */
export function jarakSidik(a: string | null | undefined, b: string | null | undefined): number | null {
  if (typeof a !== "string" || typeof b !== "string") return null;
  if (!a.length || a.length !== b.length) return null;
  const kiri = a.toLowerCase();
  const kanan = b.toLowerCase();
  if (!HEKS.test(kiri) || !HEKS.test(kanan)) return null;

  let total = 0;
  for (let i = 0; i < kiri.length; i++) {
    total += JUMLAH_BIT[parseInt(kiri[i], 16) ^ parseInt(kanan[i], 16)];
  }
  return total;
}

/**
 * Riwayat diharapkan urut dari yang terbaru. Kalau dua baris sama miripnya,
 * yang lebih dulu di daftar yang menang, jadi kontributor diberi tahu kiriman
 * terbarunya, bukan yang dua tahun lalu.
 */
export function cariDuplikat({
  sidik,
  riwayat,
  ambang,
}: {
  sidik: string | null | undefined;
  riwayat: BarisSidik[];
  ambang: number;
}): Duplikat | null {
  let terbaik: Duplikat | null = null;

  for (const baris of riwayat) {
    const jarak = jarakSidik(sidik, baris.imageHash);
    if (jarak === null || jarak > ambang) continue;
    if (terbaik && jarak >= terbaik.jarak) continue;
    terbaik = {
      id: baris.id,
      title: baris.title,
      marketplace: baris.marketplace,
      createdAt: baris.createdAt,
      jarak,
    };
    if (jarak === 0) break;
  }

  return terbaik;
}

export async function cariDuplikatUntukUser({
  userId,
  sidik,
  ambang,
}: {
  userId: string;
  sidik: string | null | undefined;
  ambang: number;
}): Promise<Duplikat | null> {
  if (typeof sidik !== "string" || !sidik) return null;

  const riwayat = await prisma.metadataLog.findMany({
    where: { userId, imageHash: { not: null } },
    select: { id: true, title: true, marketplace: true, createdAt: true, imageHash: true },
    orderBy: { createdAt: "desc" },
    take: BATAS_RIWAYAT_BANDING,
  });

  return cariDuplikat({ sidik, riwayat, ambang });
}
