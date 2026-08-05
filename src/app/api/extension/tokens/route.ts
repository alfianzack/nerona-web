import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueExtensionToken, listExtensionTokens } from "@/lib/extension-auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, tokens: await listExtensionTokens(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : undefined;
  // `replace` is opt-in rather than the default: the manual-token escape hatch
  // deliberately keeps every token it mints (the user may be pasting one into a
  // second machine), while the one-click connect path knows the previous token
  // for that browser is already dead. `id` goes back so the caller can revoke
  // this token if the handover it is about to attempt never lands.
  const { id, token } = await issueExtensionToken(session.user.id, label, {
    replaceSameLabel: body?.replace === true,
  });
  return NextResponse.json({ ok: true, id, token });
}
