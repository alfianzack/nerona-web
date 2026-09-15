import { prisma } from "@/lib/prisma";
import { costForImage } from "@/lib/agent/pricing";
import { getAiSettings } from "@/lib/ai-settings";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { planTierFromState } from "@/lib/ai-models";
import { spendPoints } from "@/lib/points";
import { resolveProviderCredentials } from "@/lib/ai-providers";

/**
 * Generate gambar, potongan pertama.
 *
 * Spec: docs/superpowers/specs/2026-09-15-generate-gambar-design.md
 *
 * Dipisah dari rutenya supaya urutan gerbangnya bisa diuji tanpa Next.js sama
 * sekali, dan karena urutan itulah yang paling gampang salah: memanggil provider
 * sebelum memeriksa saldo berarti Nerona membayar gambar yang tidak akan pernah
 * bisa ditagihkan.
 *
 * Yang SENGAJA tidak ada di sini: penulisan ke ai_usage_logs. Tabel itu
 * berbentuk token dan rata-ratanya memberi makan estimasi poin metadata;
 * generate gambar punya buku besarnya sendiri di image_generations.
 */

export type ImageGenErrorCode =
  | "no_model"
  | "plan"
  | "no_points"
  | "no_image"
  | "blocked"
  | "upstream";

export interface ImageGenInput {
  userId: string;
  prompt: string;
  size: string;
  /** Bawaannya 1, dijepit ke MAKS_JUMLAH. Lihat catatan di konstanta itu. */
  jumlah?: number;
}

export type ImageGenResult =
  | {
      ok: true;
      id: string;
      /** Gambar pertama. Disimpan supaya pemanggil satu-gambar tetap sederhana. */
      url: string;
      urls: string[];
      /** Id baris per gambar, sejajar dengan urls. Dipakai klien untuk thumbnail. */
      ids: string[];
      points: number;
      sisaPoin: number;
    }
  | { ok: false; code: ImageGenErrorCode; pesan?: string };

/** Umur tautan provider yang diasumsikan, dipakai galeri untuk menandai baris. */
const UMUR_TAUTAN_JAM = 24;

/**
 * Batas atas jumlah gambar per permintaan.
 *
 * Bukan batas teknis provider, melainkan penjaga saldo: satu klik keliru pada
 * kolom jumlah tidak boleh menghabiskan poin sebulan. Angka di luar rentang
 * DIJEPIT, bukan ditolak, supaya permintaan yang wajar tidak gagal karena satu
 * digit yang kelebihan.
 */
const MAKS_JUMLAH = 4;

function bolehPakai(
  row: { planFree: boolean; planPro: boolean; planBusiness: boolean },
  tier: "free" | "pro" | "business"
) {
  if (tier === "free") return row.planFree;
  if (tier === "pro") return row.planPro;
  return row.planBusiness;
}

/**
 * Penyaring keamanan provider memakai kata yang berbeda-beda, tapi semuanya
 * datang sebagai 4xx dengan alasan yang menyebut kebijakan. Dibedakan dari
 * "servernya sedang mati" karena tindakan tenant berbeda: yang satu menulis
 * ulang prompt, yang satu menunggu.
 */
function terlihatDitolakPenyaring(status: number, pesan: string): boolean {
  if (status < 400 || status >= 500) return false;
  return /safety|policy|content|moderat|blocked|rejected|violat/i.test(pesan);
}

export async function generateImage(input: ImageGenInput): Promise<ImageGenResult> {
  const { userId, prompt, size } = input;
  const jumlah = Math.min(MAKS_JUMLAH, Math.max(1, Math.floor(input.jumlah ?? 1)));

  const [row, settings, state] = await Promise.all([
    prisma.aiModel.findFirst({
      // kind: "image" bukan sekadar penyaring rapi. Baris chat yang terpilih di
      // sini akan dipanggil ke endpoint gambar dan ditagih dengan tarif yang
      // tidak dimilikinya.
      where: { kind: "image", isDefault: true, active: true },
      include: { provider: true },
    }),
    getAiSettings(),
    getExtensionAccountState(userId),
  ]);

  if (!row) return { ok: false, code: "no_model" };

  const tier = planTierFromState(state);
  if (!bolehPakai(row as never, tier)) return { ok: false, code: "plan" };

  let poinSatuan: number;
  try {
    poinSatuan = costForImage({
      usdPerImage: (row as { usdPerImage: number | null }).usdPerImage,
      pointsPerUsd: settings.pricing.pointsPerUsd,
    });
  } catch (err) {
    // Baris image tanpa tarif adalah salah konfigurasi owner, bukan kesalahan
    // tenant, dan tidak boleh muncul sebagai kegagalan provider.
    console.error("[image-generation] tarif belum diisi", err);
    return { ok: false, code: "no_model" };
  }

  // Saldo diperiksa SEBELUM provider dipanggil, dan untuk SELURUH permintaan.
  // Memeriksa satu gambar saja akan meloloskan permintaan yang berakhir dengan
  // saldo minus atau potongan yang gagal separuh jalan.
  if (state.pointsBalance < poinSatuan * jumlah) return { ok: false, code: "no_points" };

  const { apiKey, baseUrl } = resolveProviderCredentials(row.provider ?? null);
  if (!apiKey) return { ok: false, code: "no_model" };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: row.modelId, prompt, size, n: jumlah }),
    });
  } catch (err) {
    console.error("[image-generation] gagal menghubungi provider", err);
    return { ok: false, code: "upstream" };
  }

  const data = await res.json().catch(() => null);
  const pesan = String((data as { error?: { message?: string } })?.error?.message ?? "");

  if (!res.ok) {
    if (terlihatDitolakPenyaring(res.status, pesan)) {
      return { ok: false, code: "blocked", pesan };
    }
    console.error("[image-generation] provider menolak", { status: res.status, pesan });
    return { ok: false, code: "upstream", pesan };
  }

  const urls = ((data as { data?: Array<{ url?: string }> })?.data ?? [])
    .map((d) => d?.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
  const url = urls[0];
  if (!url) {
    // Ini bentuk kegagalan yang paling mahal, karena HTTP-nya 200 dan tidak ada
    // galat apa pun: tokennya sudah terpakai di sisi provider, tapi tenant tidak
    // mendapat apa-apa. Yang tidak boleh terjadi adalah ia ikut membayarnya.
    console.error("[image-generation] balasan tanpa URL gambar", { modelId: row.modelId });
    return { ok: false, code: "no_image" };
  }

  // Ditagih untuk yang BENAR-BENAR jadi, bukan untuk yang diminta. Provider
  // boleh mengembalikan lebih sedikit, dan menagih selisihnya berarti menagih
  // untuk gambar yang tidak pernah ada.
  const poin = poinSatuan * urls.length;
  const kedaluwarsa = new Date(Date.now() + UMUR_TAUTAN_JAM * 60 * 60 * 1000);

  // Satu baris per gambar: galerinya memang per gambar, dan tiap gambar punya
  // tautan serta thumbnail-nya sendiri.
  const baris = await Promise.all(
    urls.map((u) =>
      prisma.imageGeneration.create({
        data: {
          userId,
          aiModelId: row.id,
          prompt,
          size,
          providerUrl: u,
          urlExpiresAt: kedaluwarsa,
          points: poinSatuan,
          status: "ok",
        },
      })
    )
  );

  let sisaPoin = state.pointsBalance - poin;
  try {
    sisaPoin = await spendPoints({ userId, cost: poin, note: "Generate gambar" });
  } catch (err) {
    // Barisnya sudah tertulis dan gambarnya sudah jadi. Gagal memotong poin di
    // sini tidak boleh membatalkan hasil yang sudah dibayar Nerona ke provider.
    console.error("[image-generation] gagal memotong poin", err);
  }

  return {
    ok: true,
    id: baris[0].id,
    url,
    urls,
    ids: baris.map((b) => b.id),
    points: poin,
    sisaPoin,
  };
}
