import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { listModelsForTenant, setTenantModel, type PlanContext } from "@/lib/ai-models";
import { aiErrorResponse } from "@/lib/ai-errors";

/**
 * Berbayar berarti lisensinya aktif DAN paketnya bukan Free. Lisensi kedaluwarsa
 * tidak boleh lolos: kalau tidak, tenant yang paketnya habis tetap memegang model
 * mahal yang tidak lagi ia bayar.
 */
async function planContext(userId: string): Promise<PlanContext> {
  const state = await getExtensionAccountState(userId);
  const plan = (state.plan || "").trim().toLowerCase();
  return { paidPlan: Boolean(state.active) && plan !== "" && plan !== "free" };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const [plan, user] = await Promise.all([
    planContext(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { aiModelId: true } }),
  ]);
  const models = await listModelsForTenant(plan);

  return NextResponse.json({
    ok: true,
    models,
    selectedId: user?.aiModelId ?? null,
    paidPlan: plan.paidPlan,
  });
}

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
