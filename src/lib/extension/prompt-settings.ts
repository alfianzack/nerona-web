import { prisma } from "@/lib/prisma";
import {
  METADATA_CONTRACT_TAIL,
  METADATA_GENERATOR_PROMPT_ADVANCED,
  METADATA_GENERATOR_PROMPT_PRA_V4,
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
/**
 * Versi prompt advanced yang sedang dipakai: "v4" (bawaan hari ini), "pra_v4"
 * (perilaku sebelum 2026-09-14), atau "kustom" (teks owner sendiri).
 *
 * Dipisah dari teksnya, dan itu inti gunanya. Menempelkan teks lama ke
 * KEY_METADATA_ADVANCED juga "berhasil", tapi hasilnya salinan beku yang tidak
 * bisa dibedakan dari prompt tulisan owner: begitu v4 diperbaiki, tidak ada yang
 * tahu produksi sedang menjalankan versi lama.
 */
export const KEY_METADATA_VERSI = "prompt_metadata_versi";

export type VersiPrompt = "v4" | "pra_v4" | "kustom";

const ALL_KEYS = [KEY_METADATA_ADVANCED, KEY_METADATA_CONTRACT, KEY_METADATA_VERSI];

const TEKS_VERSI: Record<"v4" | "pra_v4", string> = {
  v4: METADATA_GENERATOR_PROMPT_ADVANCED,
  pra_v4: METADATA_GENERATOR_PROMPT_PRA_V4,
};

function bacaVersi(nilai: string | undefined): VersiPrompt {
  // Nilai asing jatuh ke v4, tidak diteruskan apa adanya: kunci Setting bisa
  // disunting tangan, dan versi yang tidak dikenal harus berarti "yang berlaku",
  // bukan prompt kosong.
  return nilai === "pra_v4" || nilai === "kustom" ? nilai : "v4";
}

export const PROMPT_DEFAULTS = {
  advanced: METADATA_GENERATOR_PROMPT_ADVANCED,
  contract: METADATA_CONTRACT_TAIL,
} as const;

export interface PromptSettings {
  advanced: string;
  contract: string;
  versi: VersiPrompt;
}

async function readRows(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ALL_KEYS } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

function resolve(map: Map<string, string>): PromptSettings {
  const kustom = (map.get(KEY_METADATA_ADVANCED) || "").trim();
  const versiTersimpan = map.get(KEY_METADATA_VERSI);
  // Override yang sudah ada SEBELUM saklar ini tetap berlaku. Tanpa aturan ini,
  // owner yang pernah menempelkan prompt sendiri akan diam-diam kembali ke
  // bawaan pada deploy pertama sesudah fitur ini, tanpa satu pun tanda.
  const versi =
    versiTersimpan === undefined && kustom ? "kustom" : bacaVersi(versiTersimpan);
  return {
    // Teks kustom yang kosong jatuh ke v4: mengirim prompt kosong ke model
    // menghasilkan tagihan tanpa hasil, dan itu bentuk kegagalan yang paling
    // mahal karena tidak ada galat apa pun yang muncul.
    advanced: versi === "kustom" ? kustom || TEKS_VERSI.v4 : TEKS_VERSI[versi],
    contract: (map.get(KEY_METADATA_CONTRACT) || "").trim() || PROMPT_DEFAULTS.contract,
    versi,
  };
}

export async function getPromptSettings(): Promise<PromptSettings> {
  return resolve(await readRows());
}

export interface PromptSettingsView extends PromptSettings {
  /** Berbeda dari konstanta kode — panel menandainya supaya tidak jadi kejutan. */
  advancedOverridden: boolean;
  contractOverridden: boolean;
  /**
   * Teks kustom yang TERSIMPAN, apa pun versi yang sedang dipakai. Owner boleh
   * berpindah ke bawaan lalu kembali tanpa kehilangan tulisannya (keputusan
   * owner 2026-09-15).
   */
  advancedKustom: string;
  /** Teks kedua versi bawaan, supaya panel bisa menampilkannya tanpa menebak. */
  teks: Record<"v4" | "pra_v4", string>;
}

export async function getPromptSettingsView(): Promise<PromptSettingsView> {
  const map = await readRows();
  const resolved = resolve(map);
  return {
    ...resolved,
    advancedOverridden: resolved.advanced !== PROMPT_DEFAULTS.advanced,
    contractOverridden: resolved.contract !== PROMPT_DEFAULTS.contract,
    advancedKustom: (map.get(KEY_METADATA_ADVANCED) || "").trim(),
    teks: TEKS_VERSI,
  };
}

export interface UpdatePromptSettingsInput {
  /** Absen = biarkan; "" = kembalikan ke bawaan (barisnya dihapus). */
  advanced?: string;
  contract?: string;
  /** Absen = biarkan versi yang sekarang. */
  versi?: VersiPrompt;
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

  if (values.versi) {
    const versi = bacaVersi(values.versi);
    ops.push(
      prisma.setting.upsert({
        where: { key: KEY_METADATA_VERSI },
        create: { key: KEY_METADATA_VERSI, value: versi },
        update: { value: versi },
      })
    );
  }

  if (ops.length) await prisma.$transaction(ops as never);
}
