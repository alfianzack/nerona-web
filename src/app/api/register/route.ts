import { NextResponse } from "next/server";
import { registerUser } from "@/lib/register";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  weak_password: "Password must be at least 8 characters.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const email = String(body.email || "");
  const password = String(body.password || "");

  const result = await registerUser(email, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
