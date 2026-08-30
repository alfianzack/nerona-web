import { prisma } from "@/lib/prisma";
import type { TokenUsage } from "@/lib/agent/pricing";

/**
 * Di bawah jumlah ini, rata-ratanya lebih buruk daripada konstanta terkalibrasi
 * di pricing.ts: satu gambar yang kebetulan besar menggeser angkanya jauh, dan
 * harga yang bergoyang di layar menghancurkan kepercayaan lebih cepat daripada
 * harga yang tetap tapi sedikit meleset.
 */
export const MIN_SAMPLE = 20;

/**
 * Prompt berubah — preset tenant, prompt marketplace, panjang keyword. Rata-rata
 * dari prompt yang sudah diganti bukan ramalan, itu arsip. Jendela ini yang
 * membuat estimasi mengikuti keadaan sekarang tanpa siapa pun perlu
 * mengkalibrasi ulang dengan tangan.
 */
const WINDOW_DAYS = 30;

export interface RecordAiUsageParams {
  userId: string;
  /** NULL kalau panggilan memakai model bawaan dari Setting, bukan baris registri. */
  aiModelId: string | null;
  feature: string;
  withImage: boolean;
  usage: TokenUsage | null;
  points: number;
}

/**
 * Mencatat satu panggilan yang sudah ditagih.
 *
 * Tidak pernah melempar. Poin sudah terpotong sebelum baris ini ditulis, jadi
 * melempar di sini akan menggagalkan permintaan yang SUDAH dibayar tenant —
 * kehilangan satu catatan jauh lebih murah daripada itu.
 */
export async function recordAiUsage(params: RecordAiUsageParams): Promise<void> {
  // Tanpa laporan token dari provider tidak ada yang bisa dikalibrasi, dan
  // menulis nol akan menarik rata-ratanya turun diam-diam.
  if (!params.usage) return;
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId: params.userId,
        aiModelId: params.aiModelId,
        feature: params.feature,
        withImage: params.withImage,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
        points: params.points,
      },
    });
  } catch (err) {
    console.error("[ai-usage] gagal mencatat pemakaian", err);
  }
}

/**
 * Rata-rata pemakaian token satu gambar, per model, dari panggilan yang
 * benar-benar terjadi.
 *
 * Hanya baris BER-GAMBAR. Panggilan teks — agen, saran keyword — jauh lebih
 * kecil, dan mencampurnya akan menarik estimasi "poin per gambar" turun ke
 * angka yang tidak pernah ditagih ke siapa pun.
 *
 * Model yang tidak ada di peta hasilnya berarti "belum cukup data"; pemanggilnya
 * yang memutuskan memakai konstanta terkalibrasi sebagai gantinya.
 */
export async function averageImageUsageByModel(
  modelIds: string[]
): Promise<Map<string, TokenUsage>> {
  const ids = modelIds.filter(Boolean);
  const hasil = new Map<string, TokenUsage>();
  if (ids.length === 0) return hasil;

  const rows = await prisma.aiUsageLog.groupBy({
    by: ["aiModelId"],
    where: {
      aiModelId: { in: ids },
      withImage: true,
      createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000) },
    },
    _avg: { promptTokens: true, completionTokens: true },
    _count: { _all: true },
  });

  for (const row of rows) {
    if (!row.aiModelId) continue;
    if ((row._count?._all ?? 0) < MIN_SAMPLE) continue;
    const promptTokens = Math.round(row._avg?.promptTokens ?? 0);
    const completionTokens = Math.round(row._avg?.completionTokens ?? 0);
    if (promptTokens <= 0 && completionTokens <= 0) continue;
    hasil.set(row.aiModelId, { promptTokens, completionTokens });
  }
  return hasil;
}
