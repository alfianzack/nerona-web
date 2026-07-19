import { NextResponse } from "next/server";
import { runStuckJobSweep } from "@/lib/agent/cron";

export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await runStuckJobSweep();
  return NextResponse.json({ ok: true, ...result });
}
