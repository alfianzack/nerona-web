import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteModel, setDefaultModel, updateModel, type AiModelInput } from "@/lib/ai-models";
import { aiModelErrorResponse } from "@/lib/ai-model-errors";
import { parseModelInput } from "@/lib/ai-model-input";

interface Ctx {
  params: { id: string };
}

async function admin() {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.role);
}

export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await admin())) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => null);

  try {
    // Menjadikan default itu aksi tersendiri, bukan kolom di formulir: ia
    // menyentuh SEMUA baris, dan menyelipkannya ke dalam penyuntingan biasa
    // membuat satu klik "Simpan" diam-diam memindahkan default.
    if (body?.isDefault === true) {
      await setDefaultModel(params.id);
      return NextResponse.json({ ok: true });
    }

    let input: AiModelInput;
    try {
      input = parseModelInput(body);
    } catch (err) {
      return aiModelErrorResponse(err);
    }
    const model = await updateModel(params.id, input);
    return NextResponse.json({ ok: true, id: model.id });
  } catch (err) {
    return aiModelErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await admin())) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    await deleteModel(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return aiModelErrorResponse(err);
  }
}
