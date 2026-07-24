import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeExtensionToken } from "@/lib/extension-auth";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const ok = await revokeExtensionToken(session.user.id, params.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
