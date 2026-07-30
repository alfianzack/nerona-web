import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return NextResponse.json({ ok: false, message: "Email belum diisi." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      licenses: { select: { id: true, status: true, source: true, planId: true } },
      enrollments: {
        select: { courseId: true, source: true, course: { select: { slug: true, title: true } } },
      },
      agentProfile: { select: { status: true, whatsappPhone: true, phoneVerifiedAt: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ ok: false, message: "Tidak ada pengguna dengan email itu." }, { status: 404 });
  }

  const [courses, plans] = await Promise.all([
    prisma.course.findMany({
      select: { id: true, slug: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.plan.findMany({
      select: { id: true, name: true, priceMonthly: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ ok: true, user, courses, plans });
}
