import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai-settings";
import { resolveProviderCredentials } from "@/lib/ai-providers";
import {
  REFERENCE_IMAGE_USAGE,
  costForImage,
  costForUsage,
  type AiPricing,
  type TokenUsage,
} from "@/lib/agent/pricing";
import { averageImageUsageByModel } from "@/lib/ai-usage";
import { getExtensionAccountState } from "@/lib/extension-sync";

export type AiModelErrorCode =
  | "not_found"
  | "inactive"
  | "no_vision"
  | "plan_not_allowed"
  | "label_required"
  | "model_id_required"
  | "rate_invalid"
  /** Baris kind = "image" tanpa usdPerImage yang masuk akal. */
  | "image_rate_invalid"
  | "provider_required"
  | "provider_not_found";

export class AiModelError extends Error {
  constructor(readonly code: AiModelErrorCode) {
    super(code);
    this.name = "AiModelError";
  }
}

export interface ResolvedAi {
  /** Id BARIS registri yang dipakai; null kalau jatuh ke model bawaan Setting. */
  aiModelId: string | null;
  modelId: string;
  /**
   * Nama model yang dibaca manusia, dari baris registri. Null kalau modelnya
   * datang dari Setting: di situ tidak ada label, dan menyalin `modelId` ke
   * sini hanya memindahkan id mentah ke field yang mengaku label.
   */
  label: string | null;
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
  planFree: boolean;
  planPro: boolean;
  planBusiness: boolean;
  isDefault: boolean;
  active: boolean;
  providerId: string;
  provider?: { baseUrl: string; apiKey: string } | null;
}

/**
 * Memakai costForUsage — fungsi yang sama dengan yang menagih — bukan rumus
 * kedua. Rumus kedua adalah cara paling mudah membuat angka di layar berbeda
 * dari angka yang dipotong dari saldo.
 */
export function estimatePointsPerImage(
  pricing: AiPricing,
  /**
   * Pemakaian nyata model ini kalau sudah ada cukup datanya. Tanpa itu, profil
   * terkalibrasi — yang tetap perkiraan, tapi perkiraan yang diikat ke tagihan
   * yang sungguh-sungguh pernah terjadi.
   */
  usage: TokenUsage = REFERENCE_IMAGE_USAGE
): number {
  return costForUsage({ usage, pricing });
}

function pricingFor(row: ModelRow, pointsPerUsd: number): AiPricing {
  return { inPerMTok: row.inPerMTok, outPerMTok: row.outPerMTok, pointsPerUsd };
}

/**
 * Poin per gambar untuk panel owner, dihitung menurut jenis barisnya.
 *
 * Baris image punya harga PASTI: ceil(usdPerImage x pointsPerUsd), angka yang
 * sama dengan yang dipotong Studio. Melewatkannya ke jalur tarif token seperti
 * baris chat selalu menghasilkan 1 poin, karena kolom MTok baris image memang
 * nol, dan 1 poin itu muncul justru di layar tempat owner menetapkan harganya.
 *
 * Null berarti barisnya kind = "image" tanpa tarif yang bisa dipakai. Itu
 * keadaan yang sama persis dengan yang membuat Studio bilang belum aktif, jadi
 * panel harus bisa menyebutnya, bukan menampilkan angka penggantinya.
 */
function poinPerGambarUntukPanel(
  row: { kind: string; usdPerImage: number | null } & ModelRow,
  pointsPerUsd: number,
  nyata?: TokenUsage
): number | null {
  if (row.kind !== "image") {
    return estimatePointsPerImage(pricingFor(row, pointsPerUsd), nyata);
  }
  try {
    return costForImage({ usdPerImage: row.usdPerImage, pointsPerUsd });
  } catch {
    return null;
  }
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
  const [user, global, state] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { aiModelId: true, aiModel: { include: { provider: true } } },
    }),
    getAiSettings(),
    getExtensionAccountState(userId),
  ]);

  // Paket diperiksa ulang DI SINI, bukan hanya saat memilih. Pilihan yang
  // tersimpan tidak pernah dibersihkan saat lisensi berubah, jadi tanpa ini
  // tenant yang paketnya habis tetap memakai — dan ditagih dengan tarif — model
  // yang sudah tidak berhak ia pakai. Jatuhnya ke baris bawaan, bukan galat:
  // paket yang berubah tidak boleh membuat panggilannya gagal.
  const tier = planTierFromState(state);
  const chosen = user?.aiModel as ModelRow | null | undefined;
  const picked = chosen && chosen.active && allowsPlan(chosen, tier) ? chosen : null;
  // Jatuhnya ke baris DEFAULT, bukan ke termurah. Bedanya adalah selisih antara
  // "tagihan yang owner tetapkan" dan "tagihan yang kebetulan paling murah".
  const row =
    picked ??
    ((await prisma.aiModel.findFirst({
      // kind: "chat" WAJIB di sini. Tanpanya, baris model gambar yang ditandai
      // bawaan akan terpilih sebagai model metadata, dan tarif per GAMBAR dipakai
      // sebagai tarif per JUTA TOKEN. Tagihannya meleset ribuan kali lipat dan
      // tidak ada satu pun galat yang muncul.
      where: { kind: "chat", isDefault: true, active: true },
      include: { provider: true },
    })) as ModelRow | null);

  // Tanpa baris model, model & tarif datang dari Koneksi AI dan kuncinya dari
  // provider bawaan. Tanpa provider bawaan pun, rantainya masih jatuh ke env —
  // nol baris di kedua tabel berarti perilaku sebelum keduanya ada.
  if (!row) {
    const fallback = await prisma.aiProvider.findFirst({ where: { isDefault: true } });
    const creds = resolveProviderCredentials(fallback);
    return { aiModelId: null, modelId: global.model, label: null, ...creds, pricing: global.pricing };
  }

  const creds = resolveProviderCredentials(row.provider ?? null);
  return {
    aiModelId: row.id,
    modelId: row.modelId,
    label: row.label,
    ...creds,
    pricing: pricingFor(row, global.pricing.pointsPerUsd),
  };
}

/**
 * Model untuk satu panggilan Coba prompt, yang boleh berbeda dari pilihan
 * tersimpan tenant.
 *
 * Penjagaannya sama dengan setTenantModel, ditambah `kind`: daftar di layar
 * sudah menyaring semua ini, tapi rute uji menerima id dari klien, dan
 * menyembunyikan pilihan di layar bukan penjagaan. Tarifnya dari baris yang
 * sama, jadi uji dengan model mahal ditagih dengan tarif model mahal.
 *
 * Tanpa id, hasilnya resolveAiForUser apa adanya.
 */
export async function resolveAiForTrial(userId: string, aiModelId: string | null): Promise<ResolvedAi> {
  if (!aiModelId) return resolveAiForUser(userId);

  const [row, global, state] = await Promise.all([
    prisma.aiModel.findFirst({ where: { id: aiModelId }, include: { provider: true } }) as Promise<
      (ModelRow & { kind?: string }) | null
    >,
    getAiSettings(),
    getExtensionAccountState(userId),
  ]);
  // Baris model gambar dianggap tidak ada, bukan "tidak aktif": bagi layar ini
  // ia memang bukan pilihan, dan tarif per gambarnya tidak berarti apa-apa
  // sebagai tarif per juta token.
  if (!row || (row.kind ?? "chat") !== "chat") throw new AiModelError("not_found");
  if (!row.active) throw new AiModelError("inactive");
  if (!row.vision) throw new AiModelError("no_vision");
  if (!allowsPlan(row, planTierFromState(state))) throw new AiModelError("plan_not_allowed");

  const creds = resolveProviderCredentials(row.provider ?? null);
  return {
    aiModelId: row.id,
    modelId: row.modelId,
    label: row.label,
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

export type PlanTier = "free" | "pro" | "business";

/**
 * Menerjemahkan keadaan lisensi jadi tingkat paket.
 *
 * Lisensi kedaluwarsa turun ke free: kalau tidak, tenant yang paketnya habis
 * tetap memegang model mahal yang tidak lagi ia bayar.
 *
 * Paket berbayar yang belum punya kolomnya sendiri diperlakukan sebagai pro,
 * bukan free — menurunkan pelanggan yang membayar ke tingkat gratis adalah
 * kegagalan yang jauh lebih terasa daripada memberinya satu model ekstra.
 */
export function planTierFromState(state: { active: boolean; plan: string | null }): PlanTier {
  if (!state.active) return "free";
  const nama = (state.plan || "").trim().toLowerCase();
  if (!nama || nama === "free") return "free";
  if (nama === "business") return "business";
  return "pro";
}

const KOLOM_PAKET = {
  free: "planFree",
  pro: "planPro",
  business: "planBusiness",
} as const;

/** Apakah satu baris boleh dipakai tingkat paket ini. */
function allowsPlan(row: Pick<ModelRow, "planFree" | "planPro" | "planBusiness">, tier: PlanTier) {
  return row[KOLOM_PAKET[tier]];
}

export interface PlanContext {
  tier: PlanTier;
}

/**
 * Daftar yang boleh dilihat tenant.
 *
 * Model tanpa penglihatan tidak pernah masuk: empat dari lima fitur mengirim
 * gambar, jadi menawarkannya sama dengan menawarkan pilihan yang pasti gagal —
 * dan gagalnya setelah poin terpotong.
 */
/** Bahan mentah daftar model, sebelum disaring per paket. */
interface BahanDaftar {
  pricing: AiPricing;
  rows: ModelRow[];
  nyata: Map<string, TokenUsage>;
}

/**
 * Ketiga query ini tidak saling membutuhkan, jadi berangkat bersama.
 *
 * Basis datanya jauh: satu perjalanan pulang-pergi berharga ratusan milidetik,
 * dan tiga perjalanan berurutan itulah yang dulu membuat layar Model AI
 * menunggu detik-detikan untuk pekerjaan yang muat dalam satu perjalanan.
 */
function ambilBahanDaftar(): Promise<BahanDaftar> {
  return Promise.all([
    getAiSettings(),
    prisma.aiModel.findMany({
      where: {
        // Daftar ini yang dipilih tenant untuk metadata, jadi model gambar tidak
        // berhak muncul di sini meski paketnya mengizinkan.
        kind: "chat",
        active: true,
        vision: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }) as Promise<ModelRow[]>,
    averageImageUsageByModel(null),
  ]).then(([{ pricing }, rows, nyata]) => ({ pricing, rows, nyata }));
}

/**
 * Saringan paket dikerjakan di sini, bukan di klausa `where`. Bedanya bukan
 * selera: klausa `where` butuh `tier`, dan menunggunya berarti query daftar
 * tidak boleh berangkat sebelum lisensinya dibaca. `allowsPlan` menyaring baris
 * yang sama persis tanpa ketergantungan itu.
 */
function saringUntukPaket({ pricing, rows, nyata }: BahanDaftar, tier: PlanTier): TenantModelView[] {
  // Hanya kolom yang memang perlu dilihat. Tarif per baris dan `providerId`
  // urusan owner, bukan sesuatu yang perlu diketahui tenant.
  return rows
    .filter((row) => allowsPlan(row, tier))
    .map((row) => ({
      id: row.id,
      label: row.label,
      note: row.note,
      estimatedPoints: estimatePointsPerImage(
        pricingFor(row, pricing.pointsPerUsd),
        nyata.get(row.id)
      ),
      isDefault: row.isDefault,
    }));
}

export async function listModelsForTenant(plan: PlanContext): Promise<TenantModelView[]> {
  return saringUntukPaket(await ambilBahanDaftar(), plan.tier);
}

export interface TenantModelScreen {
  models: TenantModelView[];
  selectedId: string | null;
  tier: PlanTier;
}

/**
 * Semua yang dibutuhkan layar Model AI, dalam satu gelombang query.
 *
 * Tingkat paket menyaring daftar, tapi daftarnya tidak menunggu tingkat paket:
 * keduanya berangkat bersamaan dan penyaringan terjadi setelah semuanya pulang.
 */
export async function tenantModelScreen(userId: string): Promise<TenantModelScreen> {
  const [state, user, bahan] = await Promise.all([
    getExtensionAccountState(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { aiModelId: true } }),
    ambilBahanDaftar(),
  ]);

  const tier = planTierFromState(state);
  return { models: saringUntukPaket(bahan, tier), selectedId: user?.aiModelId ?? null, tier };
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
  if (!allowsPlan(row, plan.tier)) throw new AiModelError("plan_not_allowed");

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
  planFree: boolean;
  planPro: boolean;
  planBusiness: boolean;
  active: boolean;
  providerId: string;
  sortOrder?: number;
  /** "chat" (bawaan) atau "image". Nilai lain diperlakukan sebagai chat. */
  kind?: string;
  /** Tarif satu gambar dalam USD. Wajib dan hanya berlaku saat kind = "image". */
  usdPerImage?: number | null;
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

  // Jenis yang tidak dikenal jatuh ke chat, bukan diteruskan apa adanya: nilai
  // asing di kolom ini akan membuat baris itu tidak pernah terpilih oleh jalur
  // mana pun, dan owner tidak akan tahu kenapa.
  const kind = input.kind === "image" ? "image" : "chat";

  // Baris image tanpa tarif per gambar akan lolos ke produksi dan baru ketahuan
  // saat tenant pertama menekan Buat gambar, sebagai kegagalan yang terlihat
  // seperti gangguan provider. Ditolak di sini, sebelum tersimpan.
  const usdPerImage = kind === "image" ? Number(input.usdPerImage) : null;
  if (kind === "image" && (!Number.isFinite(usdPerImage) || (usdPerImage as number) <= 0)) {
    throw new AiModelError("image_rate_invalid");
  }

  return {
    label,
    modelId,
    note: (input.note || "").trim() || null,
    inPerMTok: input.inPerMTok,
    outPerMTok: input.outPerMTok,
    vision: input.vision,
    planFree: input.planFree,
    planPro: input.planPro,
    planBusiness: input.planBusiness,
    active: input.active,
    providerId,
    sortOrder: input.sortOrder ?? 0,
    kind,
    // Null untuk baris chat, bukan angka yang dikirim panel: angka yang tidak
    // pernah dipakai selalu jadi angka yang salah dibaca nanti.
    usdPerImage,
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

/**
  * Daftar lengkap untuk panel owner. Tidak ada rahasia di tabel ini lagi.
  *
  * Estimasinya dihitung DI SINI, bukan di panel: panel adalah komponen klien dan
  * tidak bisa membaca pemakaian nyata, jadi kalau ia menghitung sendiri, angka
  * yang dilihat owner akan berbeda dari angka yang dilihat tenant untuk model
  * yang sama. Satu-satunya angka yang boleh dihitung di panel adalah pratinjau
  * tarif yang sedang DIKETIK, yang memang belum jadi baris apa pun.
  */
export async function listModelsForAdmin() {
  const [rows, { pricing }] = await Promise.all([
    prisma.aiModel.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    getAiSettings(),
  ]);
  const nyata = await averageImageUsageByModel(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    estimatedPoints: poinPerGambarUntukPanel(
      row as never,
      pricing.pointsPerUsd,
      nyata.get(row.id)
    ),
  }));
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
  // Bawaan itu per JENIS: satu baris chat bawaan dan satu baris image bawaan
  // hidup berdampingan. Membersihkan seluruh tabel akan mencabut bawaan chat
  // begitu owner menandai model gambar, dan seluruh jalur metadata diam-diam
  // jatuh ke tarif Koneksi AI.
  const kind = (existing as { kind?: string }).kind ?? "chat";
  await prisma.$transaction([
    prisma.aiModel.updateMany({ where: { kind }, data: { isDefault: false } }),
    prisma.aiModel.update({ where: { id }, data: { isDefault: true, active: true } }),
  ]);
}
