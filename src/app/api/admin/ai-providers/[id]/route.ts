import { NextResponse } from "next/server";
import { deleteProvider, setDefaultProvider, updateProvider } from "@/lib/ai-providers";
import { aiErrorResponse, requireOwner } from "@/lib/ai-errors";
import { parseInput } from "@/lib/ai-provider-input";

interface Ctx {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = await requireOwner();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  try {
    // Menjadikan bawaan menyentuh SEMUA baris, jadi ia aksi tersendiri — bukan
    // kolom formulir yang diam-diam ikut terbawa satu klik "Simpan".
    if (body?.isDefault === true) {
      await setDefaultProvider(params.id);
      return NextResponse.json({ ok: true });
    }
    const provider = await updateProvider(params.id, parseInput(body));
    return NextResponse.json({ ok: true, id: provider.id });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    await deleteProvider(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
