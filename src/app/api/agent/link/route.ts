import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnProfile, normalizePhone, startPhoneLink } from "@/lib/agent/profile";
import { AGENT_ENABLED } from "@/lib/features";

export async function POST(request: Request) {
  // Halaman yang memanggil endpoint ini sedang disembunyikan; endpoint-nya
  // tidak boleh tetap menjawab. Webhook WhatsApp dan cron job TIDAK dijaga —
  // pelanggan Agent yang sudah jalan tetap dilayani.
  if (!AGENT_ENABLED) {
    return NextResponse.json({ ok: false, error: "agent_disabled" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const phone: string | undefined = body?.phone;
  if (!phone) {
    return NextResponse.json(
      { ok: false, message: "Nomor WhatsApp belum diisi." },
      { status: 400 }
    );
  }

  const profile = await getOwnProfile(session.user.id);
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { ok: false, message: "Akun agent Anda belum aktif." },
      { status: 403 }
    );
  }

  const result = await startPhoneLink(profile.id, normalizePhone(phone));
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "Nomor ini sudah terhubung ke akun lain." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, code: result.code, expires: result.expires });
}
