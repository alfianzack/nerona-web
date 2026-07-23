import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteOrder, isOrderStatus, updateOrderStatus } from "@/lib/shop";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isOrderStatus(body?.status)) {
    return NextResponse.json({ ok: false, message: "Status tidak valid." }, { status: 400 });
  }

  const order = await updateOrderStatus(session.user.id, params.id, body.status);
  if (!order) {
    return NextResponse.json({ ok: false, message: "Transaksi tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const ok = await deleteOrder(session.user.id, params.id);
  if (!ok) {
    return NextResponse.json({ ok: false, message: "Transaksi tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
