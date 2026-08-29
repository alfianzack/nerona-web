import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createModel, listModelsForAdmin, type AiModelInput } from "@/lib/ai-models";
import { aiModelErrorResponse } from "@/lib/ai-model-errors";
import { parseModelInput } from "@/lib/ai-model-input";

async function admin() {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.role);
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ ok: false }, { status: 401 });
  const models = await listModelsForAdmin();
  return NextResponse.json({ ok: true, models });
}

export async function POST(request: Request) {
  if (!(await admin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => null);
  let input: AiModelInput;
  try {
    input = parseModelInput(body);
  } catch (err) {
    return aiModelErrorResponse(err);
  }

  try {
    const model = await createModel(input);
    return NextResponse.json({ ok: true, id: model.id });
  } catch (err) {
    return aiModelErrorResponse(err);
  }
}
