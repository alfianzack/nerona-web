import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPresets } from "@/lib/prompt-presets";
import { tanganiBuatPreset } from "@/lib/prompt-preset-rute";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const presets = await listPresets(session.user.id);
  return NextResponse.json({
    ok: true,
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      body: p.body,
      isActive: p.isActive,
      updatedAt: p.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  return tanganiBuatPreset(session.user.id, body);
}
