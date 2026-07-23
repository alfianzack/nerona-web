import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitOrder } from "@/lib/orders";

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  invalid_product: { status: 400, message: "Produk tidak dikenal." },
  invalid_plan: { status: 400, message: "Paket tidak dikenal." },
  plan_not_found: { status: 500, message: "Paket belum tersedia. Hubungi admin Nerona." },
  account_disabled: {
    status: 403,
    message: "Akun agent Anda dinonaktifkan. Hubungi admin Nerona.",
  },
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const product: string | undefined = body?.product;
  const planName: string | undefined = body?.planName;
  const contactNote: string | undefined = body?.contactNote;
  if (!product || !planName) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const result = await submitOrder(session.user.id, product, planName, contactNote);
  if (!result.ok) {
    // An existing pending order isn't an error for checkout — point the client
    // at that order so they can finish paying / upload proof.
    if (result.reason === "already_pending") {
      return NextResponse.json({ ok: true, kind: "request_created", orderId: result.orderId });
    }
    const mapped = ERROR_MESSAGES[result.reason];
    return NextResponse.json(
      { ok: false, reason: result.reason, message: mapped.message },
      { status: mapped.status }
    );
  }

  return NextResponse.json({
    ok: true,
    kind: result.kind,
    orderId: result.kind === "request_created" ? result.orderId : undefined,
  });
}
