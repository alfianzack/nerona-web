import { NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/reset-password-confirm";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired: "This reset link is invalid or has expired.",
  weak_password: "Password must be at least 8 characters.",
};

export async function POST(request: Request) {
  const body = await request.json();
  const token = String(body.token || "");
  const password = String(body.password || "");

  const result = await confirmPasswordReset(token, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
