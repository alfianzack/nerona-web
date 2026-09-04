import { prisma } from "./prisma";

/**
 * Fakta paket yang dipakai halaman jualan sebagai KALIMAT, bukan sebagai tabel.
 *
 * Tabel harga sudah membaca baris Plan langsung, jadi ia tidak pernah salah.
 * Yang salah adalah kalimat-kalimat di sekitarnya: sebelum berkas ini ada,
 * "Tersedia di paket Business" diketik tangan di dua tempat — bullet
 * FeatureSection di beranda dan catatan baris di ComparisonSection — sementara
 * tabel yang berdiri beberapa bagian di bawahnya mencentang fitur yang sama di
 * ketiga paket. Audit halaman menemukannya sebagai kontradiksi yang bisa dibaca
 * pengunjung dalam satu gulir.
 *
 * Membetulkan barisnya di /admin hanya membetulkan kejadian hari ini. Selama
 * kalimatnya diketik tangan, ia akan menyimpang lagi pada suntingan berikutnya,
 * dan yang menyuntingnya tidak punya alasan untuk menduga ada dua berkas React
 * yang ikut berbohong. Aturan yang sudah tertulis di marketing-faq.ts —
 * "angka yang disalin ke dua tempat akan berbeda dari yang sebenarnya dalam
 * beberapa minggu" — berlaku sama untuk nama paket.
 *
 * Jadi kalimatnya diturunkan dari kolom yang sama dengan tabelnya.
 */

/** Urutan yang sama dengan tabel harga — lihat TIER_ORDER di pricing-tiers.ts. */
const TIER_ORDER = ["Free", "Pro", "Business"];

export interface FeatureAvailability {
  /** Nama paket yang punya fiturnya, urut seperti tabel harga. */
  plans: string[];
  /**
   * Kalimat syarat siap pakai, atau null kalau tidak ada yang perlu
   * disyaratkan — yaitu saat SEMUA paket punya, dan saat tidak satu pun punya.
   *
   * Kedua kasus itu sengaja mengembalikan null yang sama, karena keduanya sama
   * saja bagi pembaca: tidak ada batasan yang berguna untuk disebut. Yang
   * membedakan keduanya adalah `plans` — pemanggil memakai panjangnya untuk
   * memutuskan apakah fiturnya layak dipajang sama sekali.
   */
  note: string | null;
}

/**
 * Rangkaian bahasa Indonesia: "Business", "Pro dan Business",
 * "Free, Pro, dan Business".
 */
function rangkai(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} dan ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, dan ${names[names.length - 1]}`;
}

/**
 * Paket mana yang benar-benar memberi reject analyzer, menurut basis data.
 *
 * Dipakai beranda di dua tempat sekaligus, jadi keduanya bergerak bersama
 * begitu owner membalik saklarnya di /admin — termasuk menghilang seluruhnya
 * kalau ternyata tidak ada paket yang menawarkannya.
 */
export async function rejectAnalyzerAvailability(): Promise<FeatureAvailability> {
  const rows = await prisma.plan.findMany({ select: { name: true, rejectAnalyzer: true } });

  // Diurutkan menurut tabel harga, bukan menurut urutan yang dikembalikan
  // query: tanpa `orderBy` urutan baris adalah urusan basis data, dan kalimat
  // yang berubah urutannya antar-deploy terbaca seperti kesalahan.
  const plans = TIER_ORDER.filter((name) =>
    rows.some((row) => row.name === name && row.rejectAnalyzer)
  );

  // Paket di luar TIER_ORDER (mis. lisensi "Comp" yang diberikan manual) tidak
  // ikut disebut — halaman jualan hanya menjual tiga yang ada di tabelnya.
  const dijual = rows.filter((row) => TIER_ORDER.includes(row.name)).length;

  const note = plans.length === 0 || plans.length === dijual ? null : `Tersedia di paket ${rangkai(plans)}`;

  return { plans, note };
}
