import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";
import { infoPembaruanExtension } from "@/lib/extension-version";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  // Model dikirim terpisah dari `account`: itu setelan global (Setting `ai_model`),
  // bukan atribut lisensi. Hanya nama modelnya — apiKey tidak pernah keluar dari server.
  //
  // `update` ikut di sini alih-alih di endpoint sendiri: extension sudah
  // memanggil rute ini secara berkala, jadi badge versi baru tidak menambah
  // satu pun permintaan jaringan.
  const [state, ai, update] = await Promise.all([
    getExtensionAccountState(resolved.userId),
    getAiSettings(),
    infoPembaruanExtension(),
  ]);
  return NextResponse.json({
    ok: true,
    account: { ...state, validUntil: state.validUntil ? state.validUntil.toISOString() : null },
    ai: { model: ai.model },
    update,
  });
}
