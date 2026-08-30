import { prisma } from "@/lib/prisma";
import { FALLBACK_BASE_URL } from "@/lib/agent/claude-client";

export type AiProviderErrorCode = "not_found" | "label_required" | "base_url_required" | "in_use";

export class AiProviderError extends Error {
  constructor(readonly code: AiProviderErrorCode) {
    super(code);
    this.name = "AiProviderError";
  }
}

export interface ProviderCredentials {
  baseUrl: string;
  apiKey: string;
}

/**
 * Kunci dan alamat yang benar-benar dipakai satu panggilan.
 *
 * Kosong berarti "lanjut ke sumber berikutnya", bukan "tidak ada kunci" —
 * aturan yang sama dengan getAiSettings() sebelum kunci pindah ke sini. Tanpa
 * ini, deploy yang selama ini mengandalkan SUMOPOD_API_KEY akan mati pada saat
 * migrasi berjalan.
 *
 * Env dibaca saat dipanggil, bukan saat modul dimuat, supaya tes bisa
 * menyetelnya tanpa mengatur ulang urutan impor.
 */
export function resolveProviderCredentials(provider: ProviderCredentials | null): ProviderCredentials {
  return {
    apiKey: (provider?.apiKey || "").trim() || process.env.SUMOPOD_API_KEY || "",
    baseUrl:
      (provider?.baseUrl || "").trim() || process.env.SUMOPOD_BASE_URL || FALLBACK_BASE_URL,
  };
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

export interface AiProviderInput {
  label: string;
  baseUrl: string;
  /** Undefined = biarkan yang tersimpan. Kunci tidak pernah dikirim balik utuh. */
  apiKey?: string;
  sortOrder?: number;
}

function cleanInput(input: AiProviderInput) {
  const label = (input.label || "").trim();
  const baseUrl = (input.baseUrl || "").trim();
  if (!label) throw new AiProviderError("label_required");
  if (!baseUrl) throw new AiProviderError("base_url_required");
  return { label, baseUrl, sortOrder: input.sortOrder ?? 0 };
}

/** Daftar untuk panel owner — kunci hanya sebagai bentuk tersamar. */
export async function listProvidersForAdmin() {
  const rows = await prisma.aiProvider.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(({ apiKey, ...rest }) => ({
    ...rest,
    apiKeyMasked: maskKey((apiKey || "").trim()),
    apiKeySet: Boolean((apiKey || "").trim()),
  }));
}

/** Dipakai probe koneksi, yang memang butuh kuncinya utuh di sisi server. */
export async function getProviderById(id: string) {
  return prisma.aiProvider.findFirst({ where: { id } });
}

export async function createProvider(input: AiProviderInput) {
  const data = cleanInput(input);
  return prisma.aiProvider.create({ data: { ...data, apiKey: (input.apiKey || "").trim() } });
}

export async function updateProvider(id: string, input: AiProviderInput) {
  const data = cleanInput(input);
  const existing = await prisma.aiProvider.findFirst({ where: { id } });
  if (!existing) throw new AiProviderError("not_found");
  const apiKey = input.apiKey === undefined ? undefined : input.apiKey.trim();
  return prisma.aiProvider.update({
    where: { id },
    data: { ...data, ...(apiKey === undefined ? {} : { apiKey }) },
  });
}

/**
 * Penolakan diperiksa di sini, bukan hanya diserahkan ke FK RESTRICT: pesan
 * "provider ini masih dipakai N model" bisa ditindaklanjuti, galat kendala
 * basis data tidak.
 */
export async function deleteProvider(id: string) {
  const used = await prisma.aiModel.count({ where: { providerId: id } });
  if (used > 0) throw new AiProviderError("in_use");
  const { count } = await prisma.aiProvider.deleteMany({ where: { id } });
  if (!count) throw new AiProviderError("not_found");
}

/** Tepat satu bawaan, dijaga dalam satu transaksi. */
export async function setDefaultProvider(id: string) {
  const existing = await prisma.aiProvider.findFirst({ where: { id } });
  if (!existing) throw new AiProviderError("not_found");
  await prisma.$transaction([
    prisma.aiProvider.updateMany({ where: {}, data: { isDefault: false } }),
    prisma.aiProvider.update({ where: { id }, data: { isDefault: true } }),
  ]);
}
