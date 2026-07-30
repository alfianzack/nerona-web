import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { recordMetadataLog } from "@/lib/metadata-log";
import { hit } from "@/lib/rate-limit";

function bearerToken(request: Request): string | null {
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Pencatatan riwayat, bukan jalur generate — tidak memakai poin dan tidak
 * memanggil AI. Extension memanggilnya sambil lalu setelah metadata final
 * terbentuk, jadi kegagalan di sini tidak boleh menghentikan apa pun.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Batasnya lebih longgar dari /generate: satu batch bisa mengirim 50 catatan
  // beruntun, dan menolaknya berarti kehilangan riwayat yang generate-nya sudah
  // dibayar dengan poin.
  const rl = hit(`extlog:${resolved.userId}`, 200, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    const row = await recordMetadataLog({
      userId: resolved.userId,
      marketplace: body.marketplace,
      pageUrl: body.pageUrl,
      title: body.title,
      keywords: body.keywords,
    });
    if (!row) {
      return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    console.error("[extension/metadata-log] failed", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
