import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { markLessonComplete } from "@/lib/lesson-progress";

export async function POST(request: Request, { params }: { params: { lessonId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await markLessonComplete(session.user.id, params.lessonId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 403;
    return NextResponse.json({ ok: false }, { status });
  }

  return NextResponse.json({ ok: true });
}
