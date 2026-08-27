import { prisma } from "@/lib/prisma";
import { buildMetadataPrompt, type BuildPromptResult } from "@/lib/extension/prompts";
import { getPromptSettings } from "@/lib/extension/prompt-settings";

export interface ResolveMetadataPromptInput {
  userId: string;
  marketplace: string;
  promptMode?: string;
  batchIndex?: number;
}

/**
 * Menentukan prompt metadata yang berlaku untuk satu panggilan: preset aktif
 * milik tenant kalau ada, kalau tidak prompt Nerona.
 *
 * Perakitannya tetap di buildMetadataPrompt — berkas ini hanya memutuskan badan
 * mana yang dipakai. Itu sebabnya jalur tanpa preset menghasilkan prompt yang
 * identik byte-for-byte dengan sebelum fitur ini ada.
 *
 * Extension dan Hub tidak perlu tahu apa-apa soal ini: keduanya sudah mengirim
 * token, dan userId-nya lahir dari token itu.
 */
export async function resolveMetadataPrompt({
  userId,
  marketplace,
  promptMode,
  batchIndex,
}: ResolveMetadataPromptInput): Promise<BuildPromptResult> {
  const [preset, settings] = await Promise.all([
    prisma.promptPreset.findFirst({ where: { userId, isActive: true } }),
    getPromptSettings(),
  ]);

  if (preset) {
    // Cap advanced, bukan cap mode yang diminta klien: prompt tenant tidak punya
    // cap sendiri untuk ditebak, dan advanced yang paling longgar dari keduanya.
    return buildMetadataPrompt({
      marketplace,
      promptMode: "advanced",
      batchIndex,
      body: preset.body,
      tail: settings.contract,
    });
  }

  // Override owner hanya menyentuh mode advanced — kunci Setting-nya memang
  // hanya untuk itu. Mode quick tetap konstanta di kode.
  const mode = promptMode === "quick" ? "quick" : "advanced";
  return buildMetadataPrompt({
    marketplace,
    promptMode: mode,
    batchIndex,
    body: mode === "advanced" ? settings.advanced : undefined,
  });
}
