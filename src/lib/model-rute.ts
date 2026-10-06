import { NextResponse } from "next/server";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { planTierFromState, setTenantModel, type PlanContext } from "@/lib/ai-models";
import { aiErrorResponse } from "@/lib/ai-errors";

/** Aturan pemetaannya tinggal di planTierFromState, satu tempat untuk semua pemanggil. */
async function planContext(userId: string): Promise<PlanContext> {
  return { tier: planTierFromState(await getExtensionAccountState(userId)) };
}

// GET dulu ada di rute web dan hanya dipanggil oleh ModelPicker. Sekarang layarnya
// dirender di server lewat tenantModelScreen, jadi menyimpannya berarti memelihara
// jalur kedua ke data yang sama, yang paling mungkin berbeda diam-diam.

/** Ganti model AI penyewa. Dipakai rute web (sesi) dan rute Hub (token). */
export async function tanganiUbahModel(userId: string, body: unknown): Promise<NextResponse> {
  const raw = (body as { modelId?: unknown } | null)?.modelId;
  const modelId = typeof raw === "string" ? raw : null;
  try {
    await setTenantModel(userId, modelId, await planContext(userId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
