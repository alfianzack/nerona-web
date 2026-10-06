import { chatCompletion, type ChatCompletionResult } from "@/lib/agent/claude-client";
import { costForUsage, type AiPricing } from "@/lib/agent/pricing";
import { recordAiUsage } from "@/lib/ai-usage";
import { spendPoints } from "@/lib/points";

export interface PanggilanBerbayarInput {
  userId: string;
  ai: { aiModelId: string | null; modelId: string; apiKey: string; baseUrl?: string; pricing: AiPricing };
  messages: Array<{ role: string; content: unknown }>;
  maxTokens: number;
  /** Nilai kolom `feature` di ai_usage_logs. */
  feature: string;
  withImage: boolean;
  /** Keterangan di mutasi poin. */
  note: string;
  /** Saldo sebelum panggilan, dikembalikan apa adanya kalau pemotongan gagal. */
  saldoAwal: number;
  /** Awalan log, supaya galat bisa dicari per rute. */
  label: string;
}

export type PanggilanBerbayarHasil =
  | { ok: true; text: string; usage: ChatCompletionResult["usage"]; cost: number; pointsBalance: number }
  | { ok: false; error: "ai_error" | "ai_empty" | "ai_truncated"; status: 502 };

/**
 * Satu panggilan AI yang ditagih poin: panggil, tolak balasan yang tidak bisa
 * dipakai, potong poin, catat pemakaian.
 *
 * Dipakai /api/extension/generate dan /api/prompts/coba. Aturannya satu tempat
 * karena dua salinan aturan tagihan adalah cara paling mudah membuat satu rute
 * menagih balasan kosong sementara rute lain tidak.
 */
export async function panggilAiBerbayar(input: PanggilanBerbayarInput): Promise<PanggilanBerbayarHasil> {
  const { userId, ai, label } = input;

  let result;
  try {
    result = await chatCompletion({
      messages: input.messages,
      model: ai.modelId,
      apiKey: ai.apiKey,
      baseUrl: ai.baseUrl,
      maxTokens: input.maxTokens,
    });
  } catch (err) {
    console.error(`[${label}] upstream error`, err);
    return { ok: false, error: "ai_error", status: 502 };
  }

  /**
   * Balasan yang tidak bisa dipakai tidak menagih poin.
   *
   * Dua kegagalan ini terbukti 2026-09-14, keduanya HTTP 200 tanpa galat: GPT 5
   * mengembalikan string kosong (token penalarannya menghabiskan jatah
   * max_tokens sebelum satu huruf jawaban keluar), dan gemini/gemini-3.5-flash
   * mengembalikan JSON yang terpotong di tengah. Sebelum penjaga ini keduanya
   * tetap memotong poin dan mengembalikan ok: true, jadi tenant membayar penuh
   * untuk balasan yang tidak bisa diurai extension maupun Hub.
   *
   * Ongkos ke provider tetap kita bayar, dan itu disengaja: yang salah bukan
   * tenant, dan menagih untuk hasil kosong lebih mahal daripada token hangus.
   */
  if (!result.text.trim()) {
    console.error(`[${label}] balasan kosong`, { modelId: ai.modelId, usage: result.usage });
    return { ok: false, error: "ai_empty", status: 502 };
  }
  if (result.finishReason === "length") {
    console.error(`[${label}] balasan terpotong di batas token`, {
      modelId: ai.modelId,
      maxTokens: input.maxTokens,
      usage: result.usage,
    });
    return { ok: false, error: "ai_truncated", status: 502 };
  }

  const cost = costForUsage({ usage: result.usage, pricing: ai.pricing });
  let pointsBalance = input.saldoAwal;
  try {
    pointsBalance = await spendPoints({ userId, cost, note: input.note });
  } catch (err) {
    // Hasilnya tetap dikirim: ongkos ke provider sudah dibayar, dan menahan
    // hasilnya tidak mengembalikan uang itu. Identitasnya ikut dicatat supaya
    // potongan yang lolos bisa dicocokkan dengan baris AiUsageLog jam yang sama.
    console.error(`[${label}] poin gagal dipotong`, { userId, cost, feature: input.feature, err });
  }

  await recordAiUsage({
    userId,
    aiModelId: ai.aiModelId,
    feature: input.feature,
    withImage: input.withImage,
    usage: result.usage,
    points: cost,
  });

  return { ok: true, text: result.text, usage: result.usage, cost, pointsBalance };
}
