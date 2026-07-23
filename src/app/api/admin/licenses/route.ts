import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { grantLicense, revokeLicense } from "@/lib/admin-grants";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userEmail: string | undefined = body?.userEmail;
  const action: string | undefined = body?.action;
  const planId: string | undefined = body?.planId;
  if (!userEmail || (action !== "grant" && action !== "revoke")) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }
  if (action === "grant" && !planId) {
    return NextResponse.json({ ok: false, message: "Paket belum dipilih." }, { status: 400 });
  }

  const result =
    action === "grant"
      ? await grantLicense(session.user.id, userEmail, planId as string, {
          note: body?.note,
          amount: body?.amount,
          currency: body?.currency,
        })
      : await revokeLicense(userEmail);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
