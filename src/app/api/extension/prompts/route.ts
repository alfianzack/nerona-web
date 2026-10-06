import { NextResponse } from "next/server";
import { tokenUser } from "@/lib/token-user";
import { listPresets, MAX_BODY_CHARS, MAX_NAME_CHARS, MAX_PRESETS_PER_USER } from "@/lib/prompt-presets";
import { tanganiBuatPreset } from "@/lib/prompt-preset-rute";
import { tenantModelScreen } from "@/lib/ai-models";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { MARKETPLACES } from "@/lib/marketplaces";

/**
 * Layar Prompt Nerona Hub dalam satu panggilan: preset, model, saldo, dan
 * batas. Pasangan bertoken dari /api/prompts + data yang dirender server di
 * halaman /prompt web. Prompt bawaan Nerona tidak ikut, sama dengan web.
 */
export async function GET(request: Request) {
  const userId = await tokenUser(request);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const [presets, layar, akun] = await Promise.all([listPresets(userId), tenantModelScreen(userId), getExtensionAccountState(userId)]);
  return NextResponse.json({
    ok: true,
    presets: presets.map((p) => ({ id: p.id, name: p.name, body: p.body, isActive: p.isActive, updatedAt: p.updatedAt.toISOString() })),
    models: layar.models.map(({ id, label, estimatedPoints, isDefault }) => ({ id, label, estimatedPoints, isDefault })),
    modelTersimpanId: layar.selectedId,
    pointsBalance: akun.pointsBalance,
    marketplaces: MARKETPLACES.map((m) => ({ key: m.key, label: m.label })),
    batas: { maxPresets: MAX_PRESETS_PER_USER, maxNameChars: MAX_NAME_CHARS, maxBodyChars: MAX_BODY_CHARS },
  });
}

export async function POST(request: Request) {
  const userId = await tokenUser(request);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => null);
  return tanganiBuatPreset(userId, body);
}
