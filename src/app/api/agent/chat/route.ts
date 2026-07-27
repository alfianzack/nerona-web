import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnProfile } from "@/lib/agent/profile";
import { logInbound } from "@/lib/agent/messages";
import { runAgentTurn } from "@/lib/agent/turn";
import { hit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MAX_TEXT_LENGTH = 4000;
const FAILURE_APOLOGY =
  "Maaf, ada kendala teknis di sisi kami. Coba kirim pesan itu lagi sebentar ya.";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const profile = await getOwnProfile(userId);
  if (!profile || profile.status !== "active") {
    return NextResponse.json({ ok: false, error: "inactive" }, { status: 403 });
  }

  const rl = hit(`agentchat:${userId}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", reply: "Terlalu cepat. Tunggu sebentar ya." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  await logInbound({ profileId: profile.id, body: text, channel: "web" });

  let turn;
  try {
    turn = await runAgentTurn({ profile, channel: "web" });
  } catch (err) {
    console.error("[agent/chat] turn failed", err);
    return NextResponse.json({ ok: false, reply: FAILURE_APOLOGY }, { status: 502 });
  }

  // A blocked turn is not an error: it carries a message the tenant should read
  // in the thread, exactly as WhatsApp delivers it.
  if (!turn.ok) {
    return NextResponse.json({ ok: false, blocked: turn.blocked, reply: turn.reply });
  }

  return NextResponse.json({
    ok: true,
    reply: turn.reply,
    pointsBalance: turn.pointsBalance,
  });
}
