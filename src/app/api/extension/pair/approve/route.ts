import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { approvePairing } from "@/lib/device-pairing";
import { hit, tooManyRequests, RATE_LIMITS } from "@/lib/rate-limit";

const STATUS: Record<string, number> = { not_found: 404, expired: 410, already_handled: 409 };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const limited = hit(
    `pair-approve:${session.user.id}`,
    RATE_LIMITS.accountAction.limit,
    RATE_LIMITS.accountAction.windowMs
  );
  if (!limited.ok) {
    const { body, init } = tooManyRequests(limited, "Terlalu sering. Coba lagi sebentar.");
    // `reason` ikut dikirim, bukan `message` saja: halaman persetujuan memetakan
    // `reason` ke kalimatnya sendiri, jadi tanpa ini pengguna dapat "Gagal
    // memproses kode. Coba lagi." — ajakan mencoba lagi yang dijamin gagal
    // selama jendela batas laju masih berjalan.
    return NextResponse.json({ ...body, reason: "too_many" }, init);
  }

  const payload = await request.json().catch(() => ({}));
  const code = typeof payload?.code === "string" ? payload.code : "";
  const setuju = payload?.setuju === true;
  if (!code) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  // userId SELALU dari sesi. Body tidak pernah dipercaya menentukan siapa
  // pemilik token yang akan dibuat.
  const result = await approvePairing({ userId: session.user.id, code, setuju });
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, reason: result.reason }, { status: STATUS[result.reason] ?? 400 });
}
