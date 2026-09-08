import { prisma } from "./prisma";

/**
 * Kunci `Setting` yang owner isi dari /admin setelah videonya direkam.
 *
 * Satu URL, bukan berkas di public/: rekaman layar autofill berukuran belasan
 * megabyte, dan repo ini sudah punya batas 4,5MB yang menggigit sekali di
 * Vercel (lihat docs/vercel.md). Videonya tinggal di penyimpanan objek atau
 * CDN, dan halaman hanya menyimpan alamatnya.
 */
export const DEMO_VIDEO_SETTING = "marketing_demo_video_url";

/**
 * URL video demo autofill, atau null.
 *
 * Rantainya DB → env → null, pola yang sama dipakai setiap angka pemasaran di
 * repo ini. Null bukan kasus tepi: spec redesign meminta band video lebar
 * penuh tepat setelah hero, tapi videonya direkam owner dan belum ada. Band
 * yang merender pemutar kosong memberi tahu pengunjung bahwa ada bagian
 * halaman yang belum jadi — jadi bandnya justru tidak dirender sampai
 * alamatnya masuk, sama seperti ProofSection menunggu asetnya.
 */
export async function demoVideoUrl(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: DEMO_VIDEO_SETTING } });
    const dbValue = String(row?.value || "").trim();
    if (dbValue) return dbValue;
  } catch (err) {
    // Beranda tidak boleh jatuh karena satu pita hiasan. Yang hilang pitanya,
    // bukan halamannya — kebijakan yang sama dengan marketing-points.ts.
    console.error("[marketing-demo] gagal membaca URL video demo", err);
    return null;
  }

  const envValue = String(process.env.NERONA_DEMO_VIDEO_URL || "").trim();
  return envValue || null;
}
