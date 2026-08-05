import { NextResponse } from "next/server";
import { startPairing, formatCode } from "@/lib/device-pairing";
import { limitByIp, tooManyRequests, RATE_LIMITS } from "@/lib/rate-limit";
import { baseUrl } from "@/lib/base-url";

// Satu-satunya endpoint pasangan yang tanpa auth, jadi batas laju di sini
// bukan hiasan: tanpanya siapa pun bisa membanjiri tabel device_pairings.
export async function POST(request: Request) {
  const limited = limitByIp(request, "pair-start", RATE_LIMITS.accountAction);
  if (limited) {
    const { body, init } = tooManyRequests(limited, "Terlalu sering. Coba lagi sebentar.");
    return NextResponse.json(body, init);
  }

  const payload = await request.json().catch(() => ({}));
  const kind = typeof payload?.kind === "string" ? payload.kind : "";
  if (kind !== "hub") {
    return NextResponse.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
  }
  const label = (typeof payload?.label === "string" ? payload.label : "").trim().slice(0, 80)
    || "Perangkat tanpa nama";

  const { code, deviceSecret, expiresAt } = await startPairing({ kind, label });
  const tampil = formatCode(code);
  return NextResponse.json({
    ok: true,
    code: tampil,
    deviceSecret,
    approveUrl: `${baseUrl()}/hubungkan?kode=${tampil}`,
    expiresInSec: Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000)),
  });
}
