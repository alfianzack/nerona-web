import { getExtensionAccountState } from "@/lib/extension-sync";
import { resolveAiForTrial } from "@/lib/ai-models";
import { aiErrorResponse } from "@/lib/ai-errors";
import { hit } from "@/lib/rate-limit";
import { MARKETPLACES } from "@/lib/marketplaces";
import { MAX_BODY_CHARS } from "@/lib/prompt-presets";
import { resolveTrialPrompt } from "@/lib/extension/prompt-resolver";
import { panggilAiBerbayar } from "@/lib/extension/panggilan-berbayar";
import { uraiMetadata } from "@/lib/extension/metadata-urai";

export type HasilRute = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };

/** Sama dengan /api/extension/generate. Layar ini mengecilkan gambar ke 1280px dulu, jadi batas ini jarang tersentuh. */
const MAX_IMAGE_CHARS = 12_000_000;

/**
 * SVG tidak diterima di sini walau kotak unggahnya menerima SVG: browser yang
 * merasterkannya ke JPEG sebelum dikirim. SVG mentah membuat model membalas
 * dengan prosa, bukan JSON (terbukti di extension, lihat shrinkImageBlobToInlineData).
 */
const MIME_GAMBAR = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Coba prompt: satu generate metadata dari layar Prompt, dengan teks editor
 * yang belum tentu disimpan dan model yang belum tentu tersimpan.
 *
 * Gerbangnya sama dengan /api/extension/generate (akun aktif, saldo di atas
 * nol) dan tagihannya lewat fungsi yang sama. Bedanya dua: yang masuk sesi
 * web, bukan token extension, dan hasilnya diurai di sini supaya layar tidak
 * perlu tahu bentuk kontraknya. Prompt yang dirakit tidak pernah ikut dalam
 * jawaban; hanya metadatanya.
 *
 * Dipakai rute web (sesi) dan rute Hub (token); pemanggil yang memastikan
 * userId sudah terotentikasi.
 */
export async function jalankanCobaPrompt(userId: string, masukan: unknown): Promise<HasilRute> {
  // Jauh di bawah 90/menit milik extension: ini orang yang menekan tombol
  // sambil membaca hasil, bukan batch.
  const rl = hit(`promptcoba:${userId}`, 10, 60_000);
  if (!rl.ok) {
    return {
      status: 429,
      body: { ok: false, error: "rate_limited", message: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi." },
      headers: { "Retry-After": String(rl.retryAfterSeconds) },
    };
  }

  const state = await getExtensionAccountState(userId);
  if (!state.active) {
    return {
      status: 403,
      body: { ok: false, error: "inactive", message: "Paket Anda tidak aktif. Aktifkan paket untuk mencoba prompt." },
    };
  }
  if (state.pointsBalance <= 0) {
    return { status: 402, body: { ok: false, error: "no_points", message: "Saldo poin habis." } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = masukan as any;
  const marketplace = MARKETPLACES.find((m) => m.key === body?.marketplace);
  const teks = typeof body?.body === "string" ? body.body : "";
  const img = body?.image;
  const aiModelId = typeof body?.aiModelId === "string" && body.aiModelId ? body.aiModelId : null;

  if (!marketplace || !img || !MIME_GAMBAR.has(img.mime) || typeof img.dataBase64 !== "string" || !img.dataBase64) {
    return { status: 400, body: { ok: false, error: "bad_request", message: "Gambar atau marketplace tidak valid." } };
  }
  if (teks.length > MAX_BODY_CHARS) {
    return {
      status: 400,
      body: { ok: false, error: "bad_request", message: `Prompt melebihi ${MAX_BODY_CHARS.toLocaleString("id-ID")} karakter.` },
    };
  }
  if (img.dataBase64.length > MAX_IMAGE_CHARS) {
    return { status: 413, body: { ok: false, error: "payload_too_large", message: "Gambar terlalu besar." } };
  }

  let ai;
  try {
    ai = await resolveAiForTrial(userId, aiModelId);
  } catch (err) {
    const res = aiErrorResponse(err);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }
  if (!ai.apiKey) {
    return { status: 503, body: { ok: false, error: "ai_not_configured", message: "Koneksi AI belum diatur." } };
  }

  // Label, bukan kunci: extension mengirim label ke "Context marketplace", dan
  // profil batas di prompt dicocokkan dengan nama yang dibaca manusia.
  const built = await resolveTrialPrompt({ userId, marketplace: marketplace.label, body: teks });

  const hasil = await panggilAiBerbayar({
    userId,
    ai,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: built.prompt },
          { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.dataBase64}` } },
        ],
      },
    ],
    maxTokens: built.maxTokens,
    // Nama sendiri supaya uji bisa dipisah dari generate sungguhan di laporan,
    // tapi tetap withImage: ia panggilan metadata bergambar yang sebenarnya, dan
    // ikut menghitung rata-rata "poin per gambar" model itu.
    feature: "metadata_uji",
    withImage: true,
    note: "Uji prompt",
    saldoAwal: state.pointsBalance,
    label: "prompts/coba",
  });
  if (!hasil.ok) {
    return { status: hasil.status, body: { ok: false, error: hasil.error } };
  }

  const metadata = uraiMetadata(hasil.text);
  if (!metadata) {
    // Ditagih, beda dengan balasan kosong: model sudah bekerja penuh, dan
    // extension pun menagih balasan yang gagal ia urai. Yang paling sering
    // membuat ini terjadi justru prompt tenant sendiri, dan itulah yang sedang
    // diuji di layar ini.
    return {
      status: 422,
      body: { ok: false, error: "ai_unparsed", pointsCharged: hasil.cost, pointsBalance: hasil.pointsBalance },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      ...metadata,
      model: { id: ai.aiModelId, label: ai.label },
      pointsCharged: hasil.cost,
      pointsBalance: hasil.pointsBalance,
    },
  };
}
