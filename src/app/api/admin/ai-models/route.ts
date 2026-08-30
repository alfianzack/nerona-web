import { NextResponse } from "next/server";
import { createModel, listModelsForAdmin, type AiModelInput } from "@/lib/ai-models";
import { aiErrorResponse, requireOwner } from "@/lib/ai-errors";
import { parseModelInput } from "@/lib/ai-model-input";

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  const models = await listModelsForAdmin();
  return NextResponse.json({ ok: true, models });
}

export async function POST(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  let input: AiModelInput;
  try {
    input = parseModelInput(body);
  } catch (err) {
    return aiErrorResponse(err);
  }

  try {
    const model = await createModel(input);
    return NextResponse.json({ ok: true, id: model.id });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
