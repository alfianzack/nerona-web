import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AiModelError, type AiModelErrorCode } from "@/lib/ai-models";
import { AiProviderError, type AiProviderErrorCode } from "@/lib/ai-providers";

/**
 * Satu tempat menerjemahkan penolakan model & provider jadi jawaban HTTP,
 * supaya rute tenant dan rute owner tidak menjelaskan sebab yang sama dengan
 * kata berbeda.
 */
const MODEL_MESSAGES: Record<AiModelErrorCode, string> = {
  not_found: "Model tidak ditemukan.",
  inactive: "Model itu sedang tidak aktif.",
  no_vision: "Model itu tidak bisa membaca gambar, jadi tidak bisa dipakai untuk metadata.",
  plan_not_allowed: "Model itu tidak tersedia untuk paket Anda.",
  label_required: "Nama model wajib diisi.",
  model_id_required: "Model id wajib diisi.",
  rate_invalid: "Tarif harus angka 0 atau lebih.",
  provider_required: "Provider wajib dipilih.",
  provider_not_found: "Provider itu tidak ditemukan.",
};

const MODEL_STATUS: Partial<Record<AiModelErrorCode, number>> = {
  not_found: 404,
  plan_not_allowed: 403,
  provider_not_found: 404,
};

const PROVIDER_MESSAGES: Record<AiProviderErrorCode, string> = {
  not_found: "Provider tidak ditemukan.",
  label_required: "Nama provider wajib diisi.",
  base_url_required: "Alamat gateway wajib diisi.",
  in_use: "Provider itu masih dipakai model. Pindahkan modelnya dulu, baru hapus providernya.",
  is_default: "Provider bawaan tidak bisa dihapus. Jadikan provider lain bawaan dulu, baru hapus yang ini.",
};

const PROVIDER_STATUS: Partial<Record<AiProviderErrorCode, number>> = {
  not_found: 404,
  in_use: 409,
  is_default: 409,
};

export function aiErrorResponse(err: unknown) {
  if (err instanceof AiModelError) {
    return NextResponse.json(
      { ok: false, message: MODEL_MESSAGES[err.code] },
      { status: MODEL_STATUS[err.code] ?? 400 }
    );
  }
  if (err instanceof AiProviderError) {
    return NextResponse.json(
      { ok: false, message: PROVIDER_MESSAGES[err.code] },
      { status: PROVIDER_STATUS[err.code] ?? 400 }
    );
  }
  throw err;
}

/**
 * Model dan provider menetapkan tarif dan memegang kunci — keduanya uang, jadi
 * `support` tidak cukup. 403, bukan 401: ia memang masuk, hanya tidak
 * berwenang. Pola yang sama dengan api/admin/prompts.
 */
export async function requireOwner(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) return NextResponse.json({ ok: false }, { status: 401 });
  if (session.user.role !== "owner_admin") {
    return NextResponse.json({ ok: false, message: "Hanya owner." }, { status: 403 });
  }
  return null;
}
