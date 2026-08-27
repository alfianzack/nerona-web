import { prisma } from "@/lib/prisma";

export const MAX_PRESETS_PER_USER = 20;
export const MAX_NAME_CHARS = 60;
/**
 * Badan prompt ikut terkirim setiap panggilan, jadi batas ini bukan soal ruang
 * simpan melainkan biaya berulang dalam token — dan poin yang terbakar itu poin
 * tenant sendiri.
 */
export const MAX_BODY_CHARS = 6_000;

export type PromptPresetErrorCode =
  | "name_required"
  | "name_too_long"
  | "body_required"
  | "body_too_long"
  | "too_many"
  | "not_found";

export class PromptPresetError extends Error {
  constructor(readonly code: PromptPresetErrorCode) {
    super(code);
    this.name = "PromptPresetError";
  }
}

export interface PresetInput {
  name: string;
  body: string;
}

function clean({ name, body }: PresetInput): PresetInput {
  const cleanName = (name ?? "").trim();
  const cleanBody = (body ?? "").trim();
  if (!cleanName) throw new PromptPresetError("name_required");
  if (cleanName.length > MAX_NAME_CHARS) throw new PromptPresetError("name_too_long");
  if (!cleanBody) throw new PromptPresetError("body_required");
  if (cleanBody.length > MAX_BODY_CHARS) throw new PromptPresetError("body_too_long");
  return { name: cleanName, body: cleanBody };
}

/** Kepemilikan diperiksa sebelum tulisan apa pun — id saja tidak cukup. */
async function ownedOrThrow(userId: string, id: string) {
  const preset = await prisma.promptPreset.findFirst({ where: { id, userId } });
  if (!preset) throw new PromptPresetError("not_found");
  return preset;
}

export async function listPresets(userId: string) {
  return prisma.promptPreset.findMany({
    where: { userId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createPreset(userId: string, input: PresetInput) {
  const data = clean(input);
  const existing = await prisma.promptPreset.count({ where: { userId } });
  if (existing >= MAX_PRESETS_PER_USER) throw new PromptPresetError("too_many");

  // Lahir dalam keadaan mati: menyimpan preset baru tidak boleh diam-diam
  // mengubah hasil generate berikutnya. Tenant yang memilih kapan ia berlaku.
  return prisma.promptPreset.create({ data: { userId, ...data, isActive: false } });
}

export async function updatePreset(userId: string, id: string, input: PresetInput) {
  const data = clean(input);
  await ownedOrThrow(userId, id);
  return prisma.promptPreset.update({ where: { id }, data });
}

export async function activatePreset(userId: string, id: string) {
  await ownedOrThrow(userId, id);
  // Satu transaksi, bukan dua panggilan: di antara keduanya tidak boleh ada
  // sesaat pun keadaan "tidak ada yang aktif" atau "dua yang aktif".
  await prisma.$transaction([
    prisma.promptPreset.updateMany({ where: { userId }, data: { isActive: false } }),
    prisma.promptPreset.update({ where: { id }, data: { isActive: true } }),
  ]);
}

/** Kembali ke prompt Nerona. Tidak menghapus apa pun — preset tetap tersimpan. */
export async function useNeronaPrompt(userId: string) {
  await prisma.promptPreset.updateMany({ where: { userId }, data: { isActive: false } });
}

export async function deletePreset(userId: string, id: string) {
  const { count } = await prisma.promptPreset.deleteMany({ where: { id, userId } });
  if (!count) throw new PromptPresetError("not_found");
}
