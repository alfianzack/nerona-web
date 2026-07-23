import { NextResponse } from "next/server";
import { registerUser } from "@/lib/register";
import { RATE_LIMITS, limitByIp, tooManyRequests } from "@/lib/rate-limit";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Masukkan alamat email yang valid.",
  weak_password: "Kata sandi minimal 8 karakter.",
  invalid_phone: "Masukkan nomor HP yang valid.",
};

const TOO_MANY = "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";

export async function POST(request: Request) {
  const limited = limitByIp(request, "register", RATE_LIMITS.accountAction);
  if (limited) {
    const { body, init } = tooManyRequests(limited, TOO_MANY);
    return NextResponse.json(body, init);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }
  const email = String(body.email || "");
  const password = String(body.password || "");
  const name = String(body.name || "");
  const phone = String(body.phone || "");

  const result = await registerUser(email, password, { name, phone });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
