import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { resolveAiForUser } from "@/lib/ai-models";
import { infoPembaruanExtension } from "@/lib/extension-version";
import { MARKETPLACES } from "@/lib/marketplaces";

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
  // Model dikirim terpisah dari `account`: ia setelan AI, bukan atribut lisensi.
  // Sejak registri model ada, yang dikirim adalah model yang berlaku bagi tenant
  // INI — pilihannya sendiri, atau default owner kalau ia belum memilih. Hanya nama modelnya — apiKey tidak pernah keluar dari server.
  //
  // `update` ikut di sini alih-alih di endpoint sendiri: extension sudah
  // memanggil rute ini secara berkala, jadi badge versi baru tidak menambah
  // satu pun permintaan jaringan.
  const [state, ai, update] = await Promise.all([
    getExtensionAccountState(resolved.userId),
    resolveAiForUser(resolved.userId),
    infoPembaruanExtension(),
  ]);
  return NextResponse.json({
    ok: true,
    account: { ...state, validUntil: state.validUntil ? state.validUntil.toISOString() : null },
    ai: { model: ai.modelId },
    update,
    // Daftar marketplace yang BERWENANG, dikirim ke setiap klien di setiap
    // panggilan yang memang sudah terjadi.
    //
    // Sebelum ini daftarnya disalin tangan di tiga repo, dan berkas katalog Hub
    // sendiri mengakui tidak ada tes yang bisa menyeberanginya. Itu sudah
    // menggigit sekali: `adobe_stock` vs `adobe` memblokir Adobe Stock untuk
    // setiap lisensi berdaftar eksplisit, tanpa galat di sisi mana pun.
    //
    // `marketplaces` pada lisensi diperbandingkan dengan daftar INI, jadi di
    // sinilah kebenarannya berada. Klien yang memakainya tidak bisa lagi
    // menyimpang diam-diam.
    allMarketplaces: MARKETPLACES.map((m) => m.key),
  });
}
