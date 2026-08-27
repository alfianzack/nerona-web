import { prisma } from "@/lib/prisma";
import {
  METADATA_CONTRACT_TAIL,
  METADATA_GENERATOR_PROMPT_ADVANCED,
} from "@/lib/extension/prompts";

/**
 * Prompt Nerona yang bisa disunting owner. Rantainya DB → konstanta di kode,
 * tanpa lapisan env di tengah seperti tarif poin: prompt bukan rahasia
 * lingkungan dan tidak ada gunanya berbeda antar-deploy.
 *
 * Mode `quick` sengaja tidak ikut ke sini. Tombolnya sudah dicabut dari
 * extension, jadi membawanya ke panel admin berarti menyuruh owner memelihara
 * sesuatu yang tidak punya pengguna.
 */
export const KEY_METADATA_ADVANCED = "prompt_metadata_advanced";
export const KEY_METADATA_CONTRACT = "prompt_metadata_contract";

const ALL_KEYS = [KEY_METADATA_ADVANCED, KEY_METADATA_CONTRACT];

export const PROMPT_DEFAULTS = {
  advanced: METADATA_GENERATOR_PROMPT_ADVANCED,
  contract: METADATA_CONTRACT_TAIL,
} as const;

export interface PromptSettings {
  advanced: string;
  contract: string;
}

async function readRows(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ALL_KEYS } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

function resolve(map: Map<string, string>): PromptSettings {
  return {
    advanced: (map.get(KEY_METADATA_ADVANCED) || "").trim() || PROMPT_DEFAULTS.advanced,
    contract: (map.get(KEY_METADATA_CONTRACT) || "").trim() || PROMPT_DEFAULTS.contract,
  };
}

export async function getPromptSettings(): Promise<PromptSettings> {
  return resolve(await readRows());
}

export interface PromptSettingsView extends PromptSettings {
  /** Berbeda dari konstanta kode — panel menandainya supaya tidak jadi kejutan. */
  advancedOverridden: boolean;
  contractOverridden: boolean;
}

export async function getPromptSettingsView(): Promise<PromptSettingsView> {
  const map = await readRows();
  const resolved = resolve(map);
  return {
    ...resolved,
    advancedOverridden: resolved.advanced !== PROMPT_DEFAULTS.advanced,
    contractOverridden: resolved.contract !== PROMPT_DEFAULTS.contract,
  };
}

export interface UpdatePromptSettingsInput {
  /** Absen = biarkan; "" = kembalikan ke bawaan (barisnya dihapus). */
  advanced?: string;
  contract?: string;
}

export async function updatePromptSettings(values: UpdatePromptSettingsInput): Promise<void> {
  const ops: unknown[] = [];
  const pairs: [string, string | undefined][] = [
    [KEY_METADATA_ADVANCED, values.advanced],
    [KEY_METADATA_CONTRACT, values.contract],
  ];

  for (const [key, value] of pairs) {
    if (value === undefined) continue;
    const trimmed = value.trim();
    if (!trimmed) {
      // Menghapus baris, bukan menyimpan string kosong: dengan begitu bawaan
      // yang berlaku selalu bawaan versi kode terbaru, bukan salinan beku.
      ops.push(prisma.setting.deleteMany({ where: { key } }));
      continue;
    }
    ops.push(
      prisma.setting.upsert({
        where: { key },
        create: { key, value: trimmed },
        update: { value: trimmed },
      })
    );
  }

  if (ops.length) await prisma.$transaction(ops as never);
}
