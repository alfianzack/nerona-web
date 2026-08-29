import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { resolveAiForUser } from "@/lib/ai-models";
import { chatCompletion } from "@/lib/agent/claude-client";
import { costForUsage } from "@/lib/agent/pricing";
import { spendPoints } from "@/lib/points";
import { hit } from "@/lib/rate-limit";
import { tolakKalauBasi } from "@/lib/extension-version";
import { resolveMetadataPrompt } from "@/lib/extension/prompt-resolver";
import {
  buildScoringPrompt,
  buildCommercialIntentPrompt,
  buildKeywordPrompt,
  buildRejectPrompt,
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

  // Tarif ikut model yang dipilih tenant ini, dan diputuskan SEBELUM panggilan.
  // Setelah panggilan, id model yang dikembalikan provider tidak pernah dipakai
  // untuk mencari tarif — itu jalan yang dulu menagih kurang tanpa suara.
  const { modelId, apiKey, baseUrl, pricing } = await resolveAiForUser(resolved.userId);
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ai_not_configured" }, { status: 503 });
  }

  let result;
  try {
    result = await chatCompletion({
      messages,
      model: modelId,
      apiKey,
      baseUrl,
      maxTokens: built.maxTokens,
    });
  } catch (err) {
    console.error("[extension/generate] upstream error", err);
    return NextResponse.json({ ok: false, error: "ai_error" }, { status: 502 });
  }

  const cost = costForUsage({ usage: result.usage, pricing });
  let pointsBalance = state.pointsBalance;
  try {
    pointsBalance = await spendPoints({ userId: resolved.userId, cost, note: `Extension ${feature}` });
  } catch (err) {
    console.error("[extension/generate] spend failed", err);
  }

  return NextResponse.json({ ok: true, content: result.text, usage: result.usage, pointsBalance });
}
