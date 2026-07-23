import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { grantEnrollment, revokeEnrollment } from "@/lib/admin-grants";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userEmail: string | undefined = body?.userEmail;
  const courseId: string | undefined = body?.courseId;
  const action: string | undefined = body?.action;
  if (!userEmail || !courseId || (action !== "grant" && action !== "revoke")) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const result =
    action === "grant"
      ? await grantEnrollment(session.user.id, userEmail, courseId, {
          note: body?.note,
          amount: body?.amount,
          currency: body?.currency,
        })
      : await revokeEnrollment(userEmail, courseId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
