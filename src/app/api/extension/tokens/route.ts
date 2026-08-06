import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueExtensionToken, listExtensionTokens } from "@/lib/extension-auth";
import { instalasiSah } from "@/lib/device-label";

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
  // Only a well-formed installation id may scope a revoke. Anything else is
  // dropped rather than passed through, so a malformed value can never widen
  // the `endsWith` filter into something that matches other devices' rows.
  // The manual-token escape hatch never sends one at all: the user may well be
  // pasting that token into a second machine on purpose.
  const installation = instalasiSah(body?.instalasi) ?? undefined;
  // `id` goes back so the caller can revoke this token if the handover it is
  // about to attempt never lands.
  const { id, token } = await issueExtensionToken(session.user.id, label, {
    replaceInstallation: installation,
  });
  return NextResponse.json({ ok: true, id, token });
}
