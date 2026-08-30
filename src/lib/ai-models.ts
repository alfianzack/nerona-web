import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai-settings";
import { resolveProviderCredentials } from "@/lib/ai-providers";
import { costForUsage, type AiPricing } from "@/lib/agent/pricing";

export type AiModelErrorCode =
  | "not_found"
  | "inactive"
  | "no_vision"
  | "paid_only"
  | "label_required"
  | "model_id_required"
  | "rate_invalid"
  | "provider_required"
  | "provider_not_found";

export class AiModelError extends Error {
  constructor(readonly code: AiModelErrorCode) {
    super(code);
    this.name = "AiModelError";
  }
}

export interface ResolvedAi {
  modelId: string;
  apiKey: string;
  baseUrl: string;
  pricing: AiPricing;
}

interface ModelRow {
  id: string;
  label: string;
  modelId: string;
  note: string | null;
  inPerMTok: number;
  outPerMTok: number;
  vision: boolean;
  paidOnly: boolean;
  isDefault: boolean;
  active: boolean;
  providerId: string;
  provider?: { baseUrl: string; apiKey: string } | null;
}

/**
 * Profil token acuan untuk memperkirakan ongkos satu gambar: kira-kira sebesar
 * satu panggilan metadata advanced. Angkanya perkiraan dan memang hanya bisa
 * perkiraan — ongkos sebenarnya lahir dari token yang benar-benar terpakai, dan
 * baru diketahui setelah panggilan selesai.
 */
const REFERENCE_USAGE = { promptTokens: 1_200, completionTokens: 150 };

/**
 * Memakai costForUsage — fungsi yang sama dengan yang menagih — bukan rumus
 * kedua. Rumus kedua adalah cara paling mudah membuat angka di layar berbeda
 * dari angka yang dipotong dari saldo.
 */
export function estimatePointsPerImage(pricing: AiPricing): number {
  return costForUsage({ usage: REFERENCE_USAGE, pricing });
}

function pricingFor(row: ModelRow, pointsPerUsd: number): AiPricing {
  return { inPerMTok: row.inPerMTok, outPerMTok: row.outPerMTok, pointsPerUsd };
}

/**
 * Menentukan model dan TARIF untuk satu panggilan.
 *
 * Tarif diambil dari baris yang dipilih di sini, sebelum panggilan — tidak
 * pernah dicari dari id model yang dikembalikan provider. Pencarian semacam itu
 * yang dulu membuat `MODEL_PRICES` jatuh ke baris termurah saat meleset, dan
 * menagih kurang tanpa suara.
 *
 * Registri kosong berarti perilaku hari ini apa adanya: tidak ada satu tagihan
 * pun berubah sebelum owner mengisi tabelnya.
 */
export async function resolveAiForUser(userId: string): Promise<ResolvedAi> {
  const [user, global] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { aiModelId: true, aiModel: { include: { provider: true } } },
    }),
    getAiSettings(),
  ]);

  const picked = user?.aiModel && user.aiModel.active ? (user.aiModel as ModelRow) : null;
  // Jatuhnya ke baris DEFAULT, bukan ke termurah. Bedanya adalah selisih antara
  // "tagihan yang owner tetapkan" dan "tagihan yang kebetulan paling murah".
  const row =
    picked ??
    ((await prisma.aiModel.findFirst({
      where: { isDefault: true, active: true },
      include: { provider: true },
    })) as ModelRow | null);

  // Tanpa baris model, model & tarif datang dari Koneksi AI dan kuncinya dari
  // provider bawaan. Tanpa provider bawaan pun, rantainya masih jatuh ke env —
  // nol baris di kedua tabel berarti perilaku sebelum keduanya ada.
  if (!row) {
    const fallback = await prisma.aiProvider.findFirst({ where: { isDefault: true } });
    const creds = resolveProviderCredentials(fallback);
    return { modelId: global.model, ...creds, pricing: global.pricing };
  }

  const creds = resolveProviderCredentials(row.provider ?? null);
  return {
    modelId: row.modelId,
    ...creds,
    pricing: pricingFor(row, global.pricing.pointsPerUsd),
  };
}

export interface TenantModelView {
  id: string;
  label: string;
  note: string | null;
  estimatedPoints: number;
  isDefault: boolean;
}

export interface PlanContext {
  paidPlan: boolean;
}

/**
 * Daftar yang boleh dilihat tenant.
 *
 * Model tanpa penglihatan tidak pernah masuk: empat dari lima fitur mengirim
 * gambar, jadi menawarkannya sama dengan menawarkan pilihan yang pasti gagal —
 * dan gagalnya setelah poin terpotong.
 */
export async function listModelsForTenant(plan: PlanContext): Promise<TenantModelView[]> {
  const { pricing } = await getAiSettings();
  const rows = (await prisma.aiModel.findMany({
    where: {
      active: true,
      vision: true,
      ...(plan.paidPlan ? {} : { paidOnly: false }),
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  })) as ModelRow[];

  // Hanya kolom yang memang perlu dilihat. `apiKey` dan `baseUrl` tidak pernah
  // ikut keluar dari server.
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    note: row.note,
    estimatedPoints: estimatePointsPerImage(pricingFor(row, pricing.pointsPerUsd)),
    isDefault: row.isDefault,
  }));
}

/**
 * Menyimpan pilihan tenant. Penjagaannya di sini, bukan hanya di daftar:
 * menyembunyikan sebuah pilihan dari layar bukan penjagaan.
 */
export async function setTenantModel(
  userId: string,
  modelId: string | null,
  plan: PlanContext
): Promise<void> {
  if (modelId === null) {
    await prisma.user.update({ where: { id: userId }, data: { aiModelId: null } });
    return;
  }

  const row = (await prisma.aiModel.findFirst({ where: { id: modelId } })) as ModelRow | null;
  if (!row) throw new AiModelError("not_found");
  if (!row.active) throw new AiModelError("inactive");
  if (!row.vision) throw new AiModelError("no_vision");
  if (row.paidOnly && !plan.paidPlan) throw new AiModelError("paid_only");

  await prisma.user.update({ where: { id: userId }, data: { aiModelId: row.id } });
}

// ---------------------------------------------------------------------------
// Sisi owner
// ---------------------------------------------------------------------------

export interface AiModelInput {
  label: string;
  modelId: string;
  note?: string | null;
  inPerMTok: number;
  outPerMTok: number;
  vision: boolean;
  paidOnly: boolean;
  active: boolean;
  providerId: string;
  sortOrder?: number;
}

function cleanInput(input: AiModelInput) {
  const label = (input.label || "").trim();
  const modelId = (input.modelId || "").trim();
  if (!label) throw new AiModelError("label_required");
  if (!modelId) throw new AiModelError("model_id_required");
  for (const rate of [input.inPerMTok, input.outPerMTok]) {
    if (!Number.isFinite(rate) || rate < 0) throw new AiModelError("rate_invalid");
  }
  const providerId = (input.providerId || "").trim();
  if (!providerId) throw new AiModelError("provider_required");
  return {
    label,
    modelId,
    note: (input.note || "").trim() || null,
    inPerMTok: input.inPerMTok,
    outPerMTok: input.outPerMTok,
    vision: input.vision,
    paidOnly: input.paidOnly,
    active: input.active,
    providerId,
    sortOrder: input.sortOrder ?? 0,
  };
}

/**
 * Diperiksa di sini, bukan diserahkan ke FK: galat kendala basis data sampai ke
 * layar owner sebagai teks yang tidak bisa ditindaklanjuti.
 */
async function assertProviderExists(providerId: string) {
  const found = await prisma.aiProvider.findFirst({ where: { id: providerId } });
  if (!found) throw new AiModelError("provider_not_found");
}

/** Daftar lengkap untuk panel owner. Tidak ada rahasia di tabel ini lagi. */
export async function listModelsForAdmin() {
  return prisma.aiModel.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}

export async function createModel(input: AiModelInput) {
  const data = cleanInput(input);
  await assertProviderExists(data.providerId);
  return prisma.aiModel.create({ data });
}

export async function updateModel(id: string, input: AiModelInput) {
  const data = cleanInput(input);
  const existing = await prisma.aiModel.findFirst({ where: { id } });
  if (!existing) throw new AiModelError("not_found");
  await assertProviderExists(data.providerId);
  return prisma.aiModel.update({ where: { id }, data });
}

export async function deleteModel(id: string) {
  const { count } = await prisma.aiModel.deleteMany({ where: { id } });
  if (!count) throw new AiModelError("not_found");
}

/** Tepat satu default, dijaga dalam satu transaksi. */
export async function setDefaultModel(id: string) {
  const existing = await prisma.aiModel.findFirst({ where: { id } });
  if (!existing) throw new AiModelError("not_found");
  await prisma.$transaction([
    prisma.aiModel.updateMany({ where: {}, data: { isDefault: false } }),
    prisma.aiModel.update({ where: { id }, data: { isDefault: true, active: true } }),
  ]);
}
