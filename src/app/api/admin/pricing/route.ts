import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCoursePrice, updatePlanPrice } from "@/lib/admin-pricing";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const [plans, courses, licenseGroups, enrollmentGroups] = await Promise.all([
    prisma.plan.findMany({
      select: { id: true, name: true, priceLabel: true, marketplaces: true, rejectAnalyzer: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.course.findMany({
      select: { id: true, slug: true, title: true, priceLabel: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.license.groupBy({
      by: ["planId"],
      where: { status: { in: ["active", "comp"] } },
      _count: { _all: true },
    }),
    prisma.enrollment.groupBy({
      by: ["courseId"],
      _count: { _all: true },
    }),
  ]);

  const licensesByPlan = new Map(licenseGroups.map((g) => [g.planId, g._count._all]));
  const enrollmentsByCourse = new Map(enrollmentGroups.map((g) => [g.courseId, g._count._all]));

  return NextResponse.json({
    ok: true,
    plans: plans.map((plan) => ({ ...plan, activeLicenses: licensesByPlan.get(plan.id) ?? 0 })),
    courses: courses.map((course) => ({
      ...course,
      enrollments: enrollmentsByCourse.get(course.id) ?? 0,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const type: string | undefined = body?.type;
  const id: string | undefined = body?.id;
  const priceLabel: unknown = body?.priceLabel;
  if ((type !== "plan" && type !== "course") || !id || typeof priceLabel !== "string") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const result =
    type === "plan" ? await updatePlanPrice(id, priceLabel) : await updateCoursePrice(id, priceLabel);

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
