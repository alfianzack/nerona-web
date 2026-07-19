import { NextResponse } from "next/server";
import { handleIncomingWebhook, handleWebhookVerification } from "@/lib/agent/webhook-handler";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await handleWebhookVerification({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  });
  return new NextResponse(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const result = await handleIncomingWebhook(raw, signature);
  return NextResponse.json({ ok: result.status === 200 }, { status: result.status });
}
