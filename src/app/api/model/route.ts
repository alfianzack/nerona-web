import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { planTierFromState, setTenantModel, type PlanContext } from "@/lib/ai-models";
import { aiErrorResponse } from "@/lib/ai-errors";

/** Aturan pemetaannya tinggal di planTierFromState, satu tempat untuk semua pemanggil. */
async function planContext(userId: string): Promise<PlanContext> {
  return { tier: planTierFromState(await getExtensionAccountState(userId)) };
}

// GET dulu ada di sini dan hanya dipanggil oleh ModelPicker. Sekarang layarnya
// dirender di server lewat tenantModelScreen, jadi menyimpannya berarti memelihara
// jalur kedua ke data yang sama — yang paling mungkin berbeda diam-diam.

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const modelId = typeof body?.modelId === "string" ? body.modelId : null;

  try {
    await setTenantModel(session.user.id, modelId, await planContext(session.user.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
