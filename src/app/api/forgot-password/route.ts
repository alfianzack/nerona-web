import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/forgot-password";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "");
  await requestPasswordReset(email);
  return NextResponse.json({ ok: true });
}
