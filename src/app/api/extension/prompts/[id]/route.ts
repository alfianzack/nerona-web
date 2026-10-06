import { NextResponse } from "next/server";
import { tokenUser } from "@/lib/token-user";
import { tanganiHapusPreset, tanganiPatchPreset } from "@/lib/prompt-preset-rute";

interface Ctx {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Ctx) {
  const userId = await tokenUser(request);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  return tanganiPatchPreset(userId, params.id, await request.json().catch(() => null));
}

export async function DELETE(request: Request, { params }: Ctx) {
  const userId = await tokenUser(request);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  return tanganiHapusPreset(userId, params.id);
}
