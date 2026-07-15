import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCheckoutSession, type CheckoutInterval } from "@/lib/checkout";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const interval: CheckoutInterval = body?.interval === "yearly" ? "yearly" : "monthly";

  const result = await createCheckoutSession(session.user.email, interval);
  if (!result) {
    return NextResponse.json({ ok: false, message: "Unable to start checkout." }, { status: 400 });
  }
  return NextResponse.json(result);
}
