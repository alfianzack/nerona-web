import { NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/reset-password-confirm";
import { RATE_LIMITS, limitByIp, tooManyRequests } from "@/lib/rate-limit";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired: "Tautan atur ulang ini tidak valid atau sudah kedaluwarsa.",
  weak_password: "Kata sandi minimal 8 karakter.",
};

export async function POST(request: Request) {
  const limited = limitByIp(request, "reset-password", RATE_LIMITS.accountAction);
  if (limited) {
    const { body, init } = tooManyRequests(
      limited,
      "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."
    );
    return NextResponse.json(body, init);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }
  const token = String(body.token || "");
  const password = String(body.password || "");

  const result = await confirmPasswordReset(token, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
