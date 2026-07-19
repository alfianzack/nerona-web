import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelOrderRequest, fulfillOrderRequest, listPendingOrderRequests } from "@/lib/orders";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const orders = await listPendingOrderRequests();
  return NextResponse.json({ ok: true, orders });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderId: string | undefined = body?.orderId;
  const action: string | undefined = body?.action;
  if (!orderId || (action !== "fulfill" && action !== "cancel")) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const result =
    action === "fulfill"
      ? await fulfillOrderRequest(session.user.id, orderId)
      : await cancelOrderRequest(orderId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
