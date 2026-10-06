import { NextResponse } from "next/server";
import { tokenUser } from "@/lib/token-user";
import { tanganiUbahModel } from "@/lib/model-rute";

/** Ganti model AI dari Nerona Hub. Pasangan bertoken dari PATCH /api/model. */
export async function PATCH(request: Request) {
  const userId = await tokenUser(request);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  return tanganiUbahModel(userId, await request.json().catch(() => null));
}
