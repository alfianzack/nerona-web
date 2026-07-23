import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/forgot-password";
import { RATE_LIMITS, limitByIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = limitByIp(request, "forgot-password", RATE_LIMITS.accountAction);
  if (limited) {
    const { body, init } = tooManyRequests(
      limited,
      "Terlalu banyak permintaan. Coba lagi beberapa menit lagi."
    );
    return NextResponse.json(body, init);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }
  const email = String(body.email || "");
  await requestPasswordReset(email);
  return NextResponse.json({ ok: true });
}
