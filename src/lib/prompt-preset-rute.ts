import { NextResponse } from "next/server";
import {
  activatePreset,
  createPreset,
  deletePreset,
  updatePreset,
  useNeronaPrompt,
} from "@/lib/prompt-presets";
import { presetErrorResponse } from "@/lib/prompt-errors";

/**
 * Aturan POST/PATCH/DELETE preset, satu tempat untuk rute web (sesi) dan rute
 * Hub (token). Pemanggil hanya menentukan siapa penggunanya.
 */
export async function tanganiBuatPreset(userId: string, body: unknown): Promise<NextResponse> {
  const b = body as { name?: unknown; body?: unknown } | null;
  try {
    // userId datang dari sesi atau token, bukan dari badan permintaan; apa pun
    // yang dikirim klien di kolom itu diabaikan.
    const preset = await createPreset(userId, {
      name: typeof b?.name === "string" ? b.name : "",
      body: typeof b?.body === "string" ? b.body : "",
    });
    return NextResponse.json({
      ok: true,
      preset: { id: preset.id, name: preset.name, body: preset.body, isActive: preset.isActive },
    });
  } catch (err) {
    return presetErrorResponse(err);
  }
}

export async function tanganiPatchPreset(userId: string, id: string, body: unknown): Promise<NextResponse> {
  const b = body as { isActive?: unknown; name?: unknown; body?: unknown } | null;
  try {
    if (b?.isActive === true) {
      await activatePreset(userId, id);
      return NextResponse.json({ ok: true });
    }
    if (b?.isActive === false) {
      // Mematikan yang aktif = kembali ke prompt Nerona. Tidak ada yang dihapus:
      // preset-nya tetap tersimpan untuk dinyalakan lagi nanti.
      await useNeronaPrompt(userId);
      return NextResponse.json({ ok: true });
    }

    const preset = await updatePreset(userId, id, {
      name: typeof b?.name === "string" ? b.name : "",
      body: typeof b?.body === "string" ? b.body : "",
    });
    return NextResponse.json({
      ok: true,
      preset: { id: preset.id, name: preset.name, body: preset.body, isActive: preset.isActive },
    });
  } catch (err) {
    return presetErrorResponse(err);
  }
}

export async function tanganiHapusPreset(userId: string, id: string): Promise<NextResponse> {
  try {
    await deletePreset(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return presetErrorResponse(err);
  }
}
