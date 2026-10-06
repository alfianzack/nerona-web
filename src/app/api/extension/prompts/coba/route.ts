import { NextResponse } from "next/server";
import { tokenUser } from "@/lib/token-user";
import { jalankanCobaPrompt } from "@/lib/prompt-coba";

export const maxDuration = 60;

/** Coba prompt dari Nerona Hub. Sama dengan rute web; batas lajunya satu kunci per pengguna untuk keduanya. */
export async function POST(request: Request) {
  const userId = await tokenUser(request);
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const r = await jalankanCobaPrompt(userId, await request.json().catch(() => null));
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}
