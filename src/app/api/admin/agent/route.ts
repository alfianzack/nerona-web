import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { activateAgentProfile, disableAgentProfile } from "@/lib/agent/admin";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userEmail: string | undefined = body?.userEmail;
  const action: string | undefined = body?.action;
  if (!userEmail || (action !== "activate" && action !== "disable")) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const result =
    action === "activate"
      ? await activateAgentProfile(userEmail)
      : await disableAgentProfile(userEmail);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
