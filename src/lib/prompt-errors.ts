import { NextResponse } from "next/server";
import {
  MAX_BODY_CHARS,
  MAX_NAME_CHARS,
  MAX_PRESETS_PER_USER,
  PromptPresetError,
  type PromptPresetErrorCode,
} from "@/lib/prompt-presets";

/**
 * Satu tempat menerjemahkan kegagalan preset jadi jawaban HTTP, supaya dua route
 * (koleksi dan per-id) tidak menulis pesan yang berbeda untuk sebab yang sama.
 */
const MESSAGES: Record<PromptPresetErrorCode, string> = {
  name_required: "Nama preset wajib diisi.",
  name_too_long: `Nama preset maksimal ${MAX_NAME_CHARS} karakter.`,
  body_required: "Isi prompt wajib diisi.",
  body_too_long: `Isi prompt maksimal ${MAX_BODY_CHARS.toLocaleString("id-ID")} karakter.`,
  too_many: `Maksimal ${MAX_PRESETS_PER_USER} preset. Hapus salah satu dulu.`,
  not_found: "Preset tidak ditemukan.",
};

export function presetErrorResponse(err: unknown) {
  if (err instanceof PromptPresetError) {
    return NextResponse.json(
      { ok: false, message: MESSAGES[err.code] },
      { status: err.code === "not_found" ? 404 : 400 }
    );
  }
  throw err;
}
