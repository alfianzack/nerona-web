import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPromptSettingsView, updatePromptSettings } from "@/lib/extension/prompt-settings";

/**
 * Satu-satunya endpoint admin yang membedakan owner dari support. Panel lain
 * cukup memeriksa "punya peran atau tidak"; di sini tidak cukup — prompt Nerona
 * adalah aset inti produk, dan peran dukungan tidak punya alasan membacanya,
 * apalagi menyuntingnya.
 */
async function ownerOrProblem() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return { problem: NextResponse.json({ ok: false }, { status: 401 }) };
  }
  if (session.user.role !== "owner_admin") {
    return { problem: NextResponse.json({ ok: false }, { status: 403 }) };
  }
  return { problem: null };
}

export async function GET() {
  const { problem } = await ownerOrProblem();
  if (problem) return problem;

  const settings = await getPromptSettingsView();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(request: Request) {
  const { problem } = await ownerOrProblem();
  if (problem) return problem;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  // Absen = biarkan apa adanya; "" = kembalikan ke bawaan. Bedanya penting:
  // panel mengirim satu kolom saja saat tombol reset ditekan.
  const values: { advanced?: string; contract?: string } = {};
  for (const field of ["advanced", "contract"] as const) {
    const raw = body[field];
    if (raw === undefined) continue;
    if (typeof raw !== "string") {
      return NextResponse.json({ ok: false, message: "Isi prompt tidak valid." }, { status: 400 });
    }
    values[field] = raw;
  }

  await updatePromptSettings(values);
  return NextResponse.json({ ok: true });
}
