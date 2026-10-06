import { NextResponse } from "next/server";
import { cariDuplikatUntukUser } from "@/lib/extension/duplikat";
import { getGuardRules } from "@/lib/extension/guard-rules";
import { normalizeImageHash } from "@/lib/metadata-log";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { resolveAiForUser } from "@/lib/ai-models";
import { hit } from "@/lib/rate-limit";
import { panggilAiBerbayar } from "@/lib/extension/panggilan-berbayar";
import { tolakKalauBasi } from "@/lib/extension-version";
import { resolveMetadataPrompt } from "@/lib/extension/prompt-resolver";
import {
  buildScoringPrompt,
  buildSkorPrompt,
  buildCommercialIntentPrompt,
  buildKeywordPrompt,
  buildRejectPrompt,
  buildRisikoPrompt,
} from "@/lib/extension/prompts";

export const maxDuration = 60;
const MAX_IMAGE_CHARS = 12_000_000;

function bearerToken(request: Request): string | null {
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Empat fitur ini memakai prompt Nerona apa adanya. Hanya metadata yang boleh
 * memakai prompt kustom tenant, dan jalurnya lewat resolveMetadataPrompt di
 * bawah — ia butuh userId, yang tidak dimiliki fungsi murni ini.
 */
function buildPromptFor(feature: string, b: any): { prompt: string; maxTokens: number } | null {
  switch (feature) {
    case "scoring":
      return buildScoringPrompt({ marketplace: b.marketplace });
    case "commercial_intent":
      return buildCommercialIntentPrompt({ marketplace: b.marketplace });
    case "keyword":
      return buildKeywordPrompt({
        marketplace: b.marketplace,
        monthsCurrent: b.monthsCurrent,
        monthsNext: b.monthsNext,
        referenceDate: b.referenceDate,
      });
    case "reject":
      return buildRejectPrompt({ marketplace: b.marketplace, contextSnippet: b.contextSnippet });
    // Badge risiko pra-kirim. Bukan `reject`, dan jangan disatukan dengannya:
    // prompt reject berangkat dari premis bahwa asetnya SUDAH ditolak.
    case "risiko":
      return buildRisikoPrompt({ marketplace: b.marketplace });
    // Panel Skor Gambar. `scoring` dan `commercial_intent` dibiarkan hidup
    // untuk extension yang sudah terpasang dan belum diperbarui.
    case "skor":
      return buildSkorPrompt({ marketplace: b.marketplace, keywords: b.keywords });
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rl = hit(`extgen:${resolved.userId}`, 90, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const state = await getExtensionAccountState(resolved.userId);
  if (!state.active) {
    return NextResponse.json({ ok: false, error: "inactive" }, { status: 403 });
  }
  // Sebelum pemeriksaan poin, bukan sesudah: extension yang terlalu tua harus
  // membaca "perbarui dulu", bukan "poin habis" — pesan kedua itu mengirim
  // pengguna membeli poin untuk masalah yang bukan poin.
  //
  // Lapis kedua, dan yang berwenang. `assertAccess` di sisi extension menolak
  // lebih dulu supaya poin tidak terlanjur terbakar, persis seperti kedaluwarsa
  // sudah bekerja — tapi yang menentukan tetap di sini.
  const basi = await tolakKalauBasi(request);
  if (basi) {
    return NextResponse.json({ ok: false, error: "outdated", ...basi }, { status: 403 });
  }
  if (state.pointsBalance <= 0) {
    return NextResponse.json({ ok: false, error: "no_points" }, { status: 402 });
  }

  const body = await request.json().catch(() => null);
  const feature = body?.feature;
  const built = body
    ? feature === "metadata"
      ? await resolveMetadataPrompt({
          userId: resolved.userId,
          marketplace: body.marketplace,
          promptMode: body.promptMode,
          batchIndex: body.batchIndex,
        })
      : buildPromptFor(feature, body)
    : null;
  if (!built) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Satu-satunya tempat yang tahu pasti panggilan ini membawa gambar atau
  // tidak. Estimasi "poin per gambar" dirata-rata dari yang membawa saja.
  const withImage = feature !== "keyword";

  let content_;
  if (feature === "keyword") {
    content_ = built.prompt;
  } else {
    const img = body.image;
    if (!img?.mime || !img?.dataBase64) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }
    if (String(img.dataBase64).length > MAX_IMAGE_CHARS) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }
    content_ = [
      { type: "text", text: built.prompt },
      { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.dataBase64}` } },
    ];
  }
  const messages = [{ role: "user", content: content_ }];

  /**
   * Penjaga duplikat menumpang di panggilan yang memang sudah terjadi.
   *
   * Dijalankan berbarengan dengan panggilan AI, bukan sesudahnya: satu query
   * berindeks tidak perlu menambah waktu tunggu kontributor. Kegagalannya
   * ditelan dengan sengaja, karena tidak tahu ada duplikat jauh lebih murah
   * daripada menggagalkan generate yang metadatanya sudah jadi.
   */
  const duplikatNanti =
    feature === "metadata"
      ? getGuardRules()
          .then((rules) =>
            cariDuplikatUntukUser({
              userId: resolved.userId,
              sidik: normalizeImageHash(body.imageHash),
              ambang: rules.duplikatAmbang,
            })
          )
          .catch((err) => {
            console.error("[extension/generate] pencarian duplikat gagal", err);
            return null;
          })
      : Promise.resolve(null);

  // Tarif ikut model yang dipilih tenant ini, dan diputuskan SEBELUM panggilan.
  // Setelah panggilan, id model yang dikembalikan provider tidak pernah dipakai
  // untuk mencari tarif — itu jalan yang dulu menagih kurang tanpa suara.
  const { aiModelId, modelId, apiKey, baseUrl, pricing } = await resolveAiForUser(resolved.userId);
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ai_not_configured" }, { status: 503 });
  }

  const hasil = await panggilAiBerbayar({
    userId: resolved.userId,
    ai: { aiModelId, modelId, apiKey, baseUrl, pricing },
    messages,
    maxTokens: built.maxTokens,
    feature,
    withImage,
    note: `Extension ${feature}`,
    saldoAwal: state.pointsBalance,
    label: "extension/generate",
  });
  if (!hasil.ok) {
    return NextResponse.json({ ok: false, error: hasil.error }, { status: hasil.status });
  }

  return NextResponse.json({
    ok: true,
    content: hasil.text,
    usage: hasil.usage,
    pointsBalance: hasil.pointsBalance,
    duplikat: await duplikatNanti,
  });
}
