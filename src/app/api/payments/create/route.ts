import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startPaymentForOrder } from "@/lib/payments/orders";
import { limitByIp, tooManyRequests, RATE_LIMITS } from "@/lib/rate-limit";
import { baseUrl } from "@/lib/base-url";

const STATUS: Record<string, number> = {
  disabled: 503,
  not_configured: 503,
  order_not_found: 404,
  not_pending: 409,
  no_price: 400,
  gateway_error: 502,
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  // Setiap permintaan yang lolos membuat satu tagihan di sistem pihak ketiga.
  // Tanpa batas laju, satu tombol yang diklik berulang cukup untuk membanjiri
  // tabel milik orang lain atas nama kita.
  const limited = limitByIp(request, "payment-create", RATE_LIMITS.accountAction);
  if (limited) {
    const { body, init } = tooManyRequests(limited, "Terlalu sering. Coba lagi sebentar.");
    return NextResponse.json(body, init);
  }

  const payload = await request.json().catch(() => ({}));
  const orderId = typeof payload?.orderId === "string" ? payload.orderId.trim() : "";
  if (!orderId) return NextResponse.json({ ok: false, reason: "order_not_found" }, { status: 404 });

  const hasil = await startPaymentForOrder(session.user.id, orderId, {
    successUrl: `${baseUrl()}/order/${orderId}`,
    cancelUrl: `${baseUrl()}/order/${orderId}`,
  });

  if (!hasil.ok) {
    return NextResponse.json(
      { ok: false, reason: hasil.reason },
      { status: STATUS[hasil.reason] ?? 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    linkUrl: hasil.linkUrl,
    expiresAt: hasil.expiresAt.toISOString(),
    reused: hasil.reused,
  });
}
