import { NextResponse } from "next/server";
import { AiModelError, type AiModelErrorCode } from "@/lib/ai-models";

/**
 * Satu tempat menerjemahkan penolakan model jadi jawaban HTTP, supaya rute
 * tenant dan rute admin tidak menjelaskan sebab yang sama dengan kata berbeda.
 */
const MESSAGES: Record<AiModelErrorCode, string> = {
  not_found: "Model tidak ditemukan.",
  inactive: "Model itu sedang tidak aktif.",
  no_vision: "Model itu tidak bisa membaca gambar, jadi tidak bisa dipakai untuk metadata.",
  paid_only: "Model itu hanya untuk paket berbayar.",
  label_required: "Nama model wajib diisi.",
  model_id_required: "Model id wajib diisi.",
  rate_invalid: "Tarif harus angka 0 atau lebih.",
  provider_required: "Provider wajib dipilih.",
  provider_not_found: "Provider itu tidak ditemukan.",
};

const STATUS: Partial<Record<AiModelErrorCode, number>> = {
  not_found: 404,
  provider_not_found: 404,
  paid_only: 403,
};

export function aiModelErrorResponse(err: unknown) {
  if (err instanceof AiModelError) {
    return NextResponse.json(
      { ok: false, message: MESSAGES[err.code] },
      { status: STATUS[err.code] ?? 400 }
    );
  }
  throw err;
}
