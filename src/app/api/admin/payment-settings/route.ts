import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/payment-settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const settings = await getPaymentSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  await updatePaymentSettings({
    bankName: asString(body.bankName),
    accountNumber: asString(body.accountNumber),
    accountHolder: asString(body.accountHolder),
    instructions: asString(body.instructions),
  });

  return NextResponse.json({ ok: true });
}
