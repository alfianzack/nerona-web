import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/billing-portal";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await createBillingPortalSession(session.user.id);
  if (!result) {
    return NextResponse.json({ ok: false, message: "No subscription found." }, { status: 404 });
  }
  return NextResponse.json(result);
}
