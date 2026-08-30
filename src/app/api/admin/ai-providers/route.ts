import { NextResponse } from "next/server";
import { createProvider, listProvidersForAdmin } from "@/lib/ai-providers";
import { aiErrorResponse, requireOwner } from "@/lib/ai-errors";
import { parseInput } from "@/lib/ai-provider-input";

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  return NextResponse.json({ ok: true, providers: await listProvidersForAdmin() });
}

export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  try {
    const provider = await createProvider(parseInput(body));
    return NextResponse.json({ ok: true, id: provider.id });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
