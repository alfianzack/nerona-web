import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiSettingsView, updateAiSettings } from "@/lib/ai-settings";

const LABELS = {
  priceIn: "Harga input",
  priceOut: "Harga output",
  pointsPerUsd: "Poin per USD",
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const settings = await getAiSettingsView();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";

  const rates: Record<string, string | undefined> = {};
  for (const field of ["priceIn", "priceOut", "pointsPerUsd"] as const) {
    const raw = body[field];
    if (raw === undefined) continue; // absent = leave the stored value alone
    if (typeof raw !== "string") {
      return NextResponse.json({ ok: false, message: LABELS[field] + " tidak valid." }, { status: 400 });
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
      rates[field] = ""; // blank = clear back to the env/default fallback
      continue;
    }
    const n = Number(trimmed);
    const min = field === "pointsPerUsd" ? Number.MIN_VALUE : 0;
    if (!Number.isFinite(n) || n < min) {
      return NextResponse.json(
        {
          ok: false,
          message:
            field === "pointsPerUsd"
              ? "Poin per USD harus angka lebih besar dari 0."
              : `${LABELS[field]} harus angka 0 atau lebih.`,
        },
        { status: 400 }
      );
    }
    rates[field] = trimmed;
  }

  await updateAiSettings({ model, ...rates });

  return NextResponse.json({ ok: true });
}
