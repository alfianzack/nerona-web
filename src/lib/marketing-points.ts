import { prisma } from "./prisma";
import { getAiSettings } from "./ai-settings";
import { averageImageUsageByModel } from "./ai-usage";
import { costForUsage, REFERENCE_IMAGE_USAGE, type AiPricing } from "./agent/pricing";

/**
 * Ongkos satu gambar dalam poin, untuk halaman jualan.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA INI ADA
 * ─────────────────────────────────────────────────────────────────────────
 * FAQ menjawab "apa itu poin" dengan jujur: besarnya tergantung gambar dan
 * panjang teks yang diproses. Akibat sampingannya ditemukan audit halaman —
 * "10 poin gratis" dan "500 poin" jadi tidak berarti apa-apa bagi orang yang
 * belum pernah memakai alatnya. Ia tidak bisa menilai apakah paketnya murah,
 * jadi ia tidak bisa memutuskan, jadi ia menutup halaman.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA DIHITUNG, BUKAN DIKETIK
 * ─────────────────────────────────────────────────────────────────────────
 * Menulis "1 gambar ≈ 1–2 poin" ke dalam copy akan salah dalam hitungan
 * minggu: tarif model adalah baris basis data yang owner sunting dari /admin,
 * dan tidak ada yang akan ingat menyusuri berkas React saat menyuntingnya.
 * Repo ini sudah menolak angka semacam itu sekali — lihat docblock
 * allowanceLabel di pricing-tiers.ts soal `generationLimit`, dan spec
 * marketing-honesty yang mencatat sebaran 24× antara dua konfigurasi tarif
 * yang sama-sama masuk akal.
 *
 * Jadi angkanya datang dari `costForUsage` — FUNGSI YANG SAMA dengan yang
 * memotong saldo. Rumus kedua adalah cara paling mudah membuat angka di
 * halaman jualan berbeda dari angka yang benar-benar ditagih, dan selisih
 * semacam itu ditemukan pembeli setelah ia membayar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUMBER ANGKANYA, BERURUT
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Baris model bawaan di registri, dengan pemakaian token NYATA-nya kalau
 *    panggilan ber-gambarnya sudah cukup banyak (averageImageUsageByModel).
 * 2. Baris yang sama, dengan profil acuan REFERENCE_IMAGE_USAGE — yang sudah
 *    dikalibrasi ke tagihan sungguhan.
 * 3. Tarif Koneksi AI, kalau registri model masih kosong.
 * 4. null — dan pemanggilnya menghilangkan seluruh kalimatnya.
 *
 * Langkah 4 bukan basa-basi. Tanpa tarif, satu-satunya angka yang bisa
 * ditampilkan adalah tebakan, dan halaman ini punya aturan tertulis untuk itu:
 * kalau ragu, KURANGI.
 */

/** Tarif yang seluruh komponennya nol berarti belum diisi, bukan berarti gratis. */
function tarifTerisi(pricing: AiPricing): boolean {
  return pricing.pointsPerUsd > 0 && (pricing.inPerMTok > 0 || pricing.outPerMTok > 0);
}

export async function defaultModelPointsPerImage(): Promise<number | null> {
  try {
    const [row, settings] = await Promise.all([
      // Baris DEFAULT, bukan termurah — bedanya adalah selisih antara "tarif
      // yang owner tetapkan" dan "tarif yang kebetulan paling murah". Alasan
      // yang sama dituliskan di resolveAiForUser.
      prisma.aiModel.findFirst({ where: { isDefault: true, active: true } }),
      getAiSettings(),
    ]);

    const pricing: AiPricing = row
      ? {
          inPerMTok: row.inPerMTok,
          outPerMTok: row.outPerMTok,
          pointsPerUsd: settings.pricing.pointsPerUsd,
        }
      : settings.pricing;

    if (!tarifTerisi(pricing)) return null;

    // Peta kosong berarti "belum cukup data", dan profil acuan mengambil alih.
    const nyata = row ? (await averageImageUsageByModel([row.id])).get(row.id) : undefined;

    return costForUsage({ usage: nyata ?? REFERENCE_IMAGE_USAGE, pricing });
  } catch (err) {
    // Beranda tidak boleh jatuh karena satu kalimat penjelas. Kalimatnya yang
    // hilang, bukan halamannya.
    console.error("[marketing-points] gagal menghitung ongkos per gambar", err);
    return null;
  }
}

/**
 * Berapa gambar yang bisa dikerjakan sebuah jatah poin.
 *
 * Dibulatkan KE BAWAH: angka ini muncul di halaman jualan, dan jatah yang
 * dijanjikan lebih besar daripada yang benar-benar diberikan adalah bentuk
 * kebohongan yang paling cepat ketahuan — pembeli menemukannya di gambar
 * terakhir yang gagal.
 */
export function gambarPerPoin(poin: number, poinPerGambar: number | null): number | null {
  if (poinPerGambar === null || poinPerGambar <= 0) return null;
  return Math.floor(poin / poinPerGambar);
}
