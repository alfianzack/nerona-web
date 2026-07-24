import { NextResponse } from "next/server";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";
import { chatCompletion } from "@/lib/agent/claude-client";
import { costForUsage } from "@/lib/agent/pricing";
import { spendPoints } from "@/lib/points";
import { hit } from "@/lib/rate-limit";

export const maxDuration = 60;

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  const resolved = token ? await resolveExtensionToken(token) : null;
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rl = hit(`extai:${resolved.userId}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const state = await getExtensionAccountState(resolved.userId);
  if (!state.active) {
    return NextResponse.json({ ok: false, error: "inactive" }, { status: 403 });
  }
  if (state.pointsBalance <= 0) {
    return NextResponse.json({ ok: false, error: "no_points" }, { status: 402 });
  }

  const body = await request.json().catch(() => null);
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const MAX_MESSAGES_BYTES = 12_000_000; // ~12MB: allows one base64 image + prompt, blocks abuse
  if (JSON.stringify(messages).length > MAX_MESSAGES_BYTES) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  const { model, apiKey } = await getAiSettings();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ai_not_configured" }, { status: 503 });
  }

  let result;
  try {
    result = await chatCompletion({ messages, model, apiKey, maxTokens: 1024 });
  } catch (err) {
    console.error("[extension/ai] upstream error", err);
    return NextResponse.json({ ok: false, error: "ai_error" }, { status: 502 });
  }

  const cost = costForUsage({ model: result.model, usage: result.usage });
  let pointsBalance = state.pointsBalance;
  try {
    pointsBalance = await spendPoints({ userId: resolved.userId, cost, note: "Metadata generation" });
  } catch (err) {
    console.error("[extension/ai] spend failed", err);
  }

  return NextResponse.json({ ok: true, content: result.text, usage: result.usage, pointsBalance });
}
