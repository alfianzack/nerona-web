import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { testAiConnection } from "@/lib/ai-connection-test";
import { hit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Each check spends two real completions on the admin key.
  const rl = hit(`aitest:${session.user.id}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let result;
  try {
    result = await testAiConnection();
  } catch (err) {
    console.error("[ai-settings/test] probe threw", err);
    return NextResponse.json({ ok: false, error: "probe_failed" }, { status: 502 });
  }

  // A failing probe is a successful check with a bad answer — the UI needs the
  // detail, so this is a 200 either way.
  return NextResponse.json({ ok: true, result });
}
