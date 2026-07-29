import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPlanPointsView, updatePlanPoints, type PlanProduct } from "@/lib/plan-points";

const PRODUCTS: PlanProduct[] = ["metadata", "agent"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const rows = await getPlanPointsView();
  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const values: Array<{ product: PlanProduct; plan: string; value: string }> = [];
  for (const row of body.rows) {
    if (!row || typeof row !== "object") {
      return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
    }
    const { product, plan, value } = row as Record<string, unknown>;
    if (!PRODUCTS.includes(product as PlanProduct) || typeof plan !== "string") {
      return NextResponse.json({ ok: false, message: "Paket tidak dikenal." }, { status: 400 });
    }
    if (typeof value !== "string") {
      return NextResponse.json({ ok: false, message: "Jumlah poin tidak valid." }, { status: 400 });
    }
    const trimmed = value.trim();
    // "" clears back to the env/default fallback. Anything else must be a whole
    // number >= 0 — zero is a real allowance of nothing.
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { ok: false, message: "Jumlah poin harus bilangan bulat 0 atau lebih." },
          { status: 400 }
        );
      }
    }
    values.push({ product: product as PlanProduct, plan, value: trimmed });
  }

  await updatePlanPoints(values);
  return NextResponse.json({ ok: true });
}
