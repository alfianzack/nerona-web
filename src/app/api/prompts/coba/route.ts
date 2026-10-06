import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jalankanCobaPrompt } from "@/lib/prompt-coba";

export const maxDuration = 60;

/** Coba prompt dari layar Prompt web. Logikanya di lib/prompt-coba.ts, dipakai juga rute Hub. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const r = await jalankanCobaPrompt(userId, await request.json().catch(() => null));
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}
