import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCoursePrice, updatePlanPrice } from "@/lib/admin-pricing";
import { getAgentPricingView, updateAgentPrice } from "@/lib/agent-pricing";
import {
  DURATION_LABELS,
  PLAN_DURATIONS,
  getDurationDiscounts,
  updateDurationDiscount,
} from "@/lib/plan-duration";
import {
  TOPUP_SETTING_KEY,
  formatTopupPackages,
  getTopupPackages,
  updateTopupPackages,
} from "@/lib/topup";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const [plans, courses, licenseGroups, enrollmentGroups, agentPlans, discounts, topupRow] =
    await Promise.all([
    prisma.plan.findMany({
      select: { id: true, name: true, priceMonthly: true, marketplaces: true, rejectAnalyzer: true, hub: true },
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
    getAgentPricingView(),
    getDurationDiscounts(),
    prisma.setting.findUnique({ where: { key: TOPUP_SETTING_KEY } }),
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
    // Paket Agent dikirim terpisah dari `plans`: sumbernya Setting, bukan tabel
    // Plan, dan id-nya adalah nama paket ("pro") — bukan cuid seperti metadata.
    agentPlans,
    // Diskon durasi berlaku untuk kedua produk, jadi tidak menempel di salah satu.
    discounts: PLAN_DURATIONS.filter((m) => m !== 1).map((months) => ({
      months,
      label: DURATION_LABELS[months] ?? `${months} bulan`,
      percent: discounts[months] ?? 0,
    })),
    // Nilai mentah supaya kotak isian kosong saat owner belum pernah mengubahnya;
    // `effective` memperlihatkan daftar yang sedang berlaku.
    topup: {
      stored: topupRow?.value ?? "",
      effective: formatTopupPackages(await getTopupPackages()),
    },
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
  if (
    (type !== "plan" &&
      type !== "course" &&
      type !== "agent" &&
      type !== "discount" &&
      type !== "topup") ||
    !id ||
    typeof priceLabel !== "string"
  ) {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  if (type === "topup") {
    const saved = await updateTopupPackages(priceLabel);
    if (!saved.ok) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (type === "discount") {
    const saved = await updateDurationDiscount(Number(id), priceLabel);
    if (!saved) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  const result =
    type === "plan"
      ? await updatePlanPrice(id, priceLabel)
      : type === "agent"
        ? await updateAgentPrice(id, priceLabel)
        : await updateCoursePrice(id, priceLabel);

  if (!result.ok) {
    // Harga tidak valid adalah kesalahan input, bukan baris yang hilang —
    // 404 di sini membuat panel menampilkan pesan yang keliru.
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: result.reason === "invalid" ? 400 : 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
