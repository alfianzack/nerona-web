import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnProfile } from "@/lib/agent/profile";

export async function GET() {
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
