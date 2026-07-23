import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustPoints } from "@/lib/points";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const delta = Number(body?.delta);
  if (!Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ ok: false, message: "Jumlah poin tidak valid." }, { status: 400 });
  }

  let userId: string | undefined = body?.userId;
  if (!userId && body?.userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: body.userEmail },
      select: { id: true },
    });
    userId = user?.id;
  }
  if (!userId) {
    return NextResponse.json({ ok: false, message: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  const result = await adjustPoints({
    userId,
    delta,
    note: body?.note || undefined,
    createdById: session.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: "Saldo poin tidak boleh minus." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, balance: result.balance });
}
