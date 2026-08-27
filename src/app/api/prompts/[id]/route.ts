import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  activatePreset,
  deletePreset,
  updatePreset,
  useNeronaPrompt,
} from "@/lib/prompt-presets";
import { presetErrorResponse } from "@/lib/prompt-errors";

interface Ctx {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userId = session.user.id;

  try {
    if (body?.isActive === true) {
      await activatePreset(userId, params.id);
      return NextResponse.json({ ok: true });
    }
    if (body?.isActive === false) {
      // Mematikan yang aktif = kembali ke prompt Nerona. Tidak ada yang dihapus:
      // preset-nya tetap tersimpan untuk dinyalakan lagi nanti.
      await useNeronaPrompt(userId);
      return NextResponse.json({ ok: true });
    }

    const preset = await updatePreset(userId, params.id, {
      name: typeof body?.name === "string" ? body.name : "",
      body: typeof body?.body === "string" ? body.body : "",
    });
    return NextResponse.json({
      ok: true,
      preset: { id: preset.id, name: preset.name, body: preset.body, isActive: preset.isActive },
    });
  } catch (err) {
    return presetErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    await deletePreset(session.user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return presetErrorResponse(err);
  }
}
