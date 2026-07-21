import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changePassword } from "@/lib/profile";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, message: "Password baru minimal 8 karakter." },
      { status: 400 }
    );
  }

  const result = await changePassword(session.user.id, currentPassword, newPassword);
  if (!result.ok) {
    const message =
      result.reason === "no_password"
        ? "Akun ini memakai login Google, tidak ada password untuk diubah."
        : "Password lama salah.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
