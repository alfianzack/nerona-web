import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { RATE_LIMITS, limitByIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = limitByIp(request, "resend-verification", RATE_LIMITS.accountAction);
  if (limited) {
    const { body, init } = tooManyRequests(
      limited,
      "Terlalu banyak permintaan. Coba lagi beberapa menit lagi."
    );
    return NextResponse.json(body, init);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = await createEmailVerificationToken(session.user.id);
  await sendVerificationEmail(session.user.email, token);
  return NextResponse.json({ ok: true });
}
