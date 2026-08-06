import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnProfile } from "@/lib/agent/profile";
import { AGENT_ENABLED } from "@/lib/features";

export async function GET() {
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

  const profile = await getOwnProfile(session.user.id);
  return NextResponse.json({
    ok: true,
    profile: profile
      ? {
          whatsappPhone: profile.whatsappPhone,
          phoneVerifiedAt: profile.phoneVerifiedAt,
          status: profile.status,
        }
      : null,
  });
}
