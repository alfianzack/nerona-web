import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateProfile, type ProfileUpdate } from "@/lib/profile";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const update: ProfileUpdate = {};
  if (typeof body?.name === "string") update.name = body.name.trim() || null;
  if (typeof body?.phone === "string") update.phone = body.phone.trim() || null;
  if (typeof body?.businessName === "string") update.businessName = body.businessName.trim() || null;

  await updateProfile(session.user.id, update);
  return NextResponse.json({ ok: true });
}
