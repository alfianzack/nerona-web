import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPreset, listPresets } from "@/lib/prompt-presets";
import { presetErrorResponse } from "@/lib/prompt-errors";

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
  try {
    // userId datang dari sesi, bukan dari badan permintaan — apa pun yang
    // dikirim klien di kolom itu diabaikan.
    const preset = await createPreset(session.user.id, {
      name: typeof body?.name === "string" ? body.name : "",
      body: typeof body?.body === "string" ? body.body : "",
    });
    return NextResponse.json({
      ok: true,
      preset: { id: preset.id, name: preset.name, body: preset.body, isActive: preset.isActive },
    });
  } catch (err) {
    return presetErrorResponse(err);
  }
}
