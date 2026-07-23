import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;
const ACTIVE_LICENSE = { in: ["active", "comp"] };

const FILTERS: Record<string, Prisma.UserWhereInput> = {
  license: { licenses: { some: { status: ACTIVE_LICENSE } } },
  agent: { agentProfile: { isNot: null } },
  none: {
    licenses: { none: { status: ACTIVE_LICENSE } },
    agentProfile: { is: null },
  },
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const filter = url.searchParams.get("filter") ?? "";

  const searchWhere: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const where: Prisma.UserWhereInput = FILTERS[filter]
    ? { AND: [searchWhere, FILTERS[filter]] }
    : searchWhere;

  const [total, users, countAll, countLicense, countAgent, countNone] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        adminRole: { select: { role: true } },
        licenses: {
          select: { status: true, plan: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        agentProfile: { select: { status: true, plan: true } },
      },
    }),
    prisma.user.count({ where: searchWhere }),
    prisma.user.count({ where: { AND: [searchWhere, FILTERS.license] } }),
    prisma.user.count({ where: { AND: [searchWhere, FILTERS.agent] } }),
    prisma.user.count({ where: { AND: [searchWhere, FILTERS.none] } }),
  ]);

  const rows = users.map((user) => {
    const license = user.licenses[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      adminRole: user.adminRole?.role ?? null,
      metadata: license
        ? { status: license.status, plan: license.plan?.name ?? null }
        : null,
      agent: user.agentProfile
        ? { status: user.agentProfile.status, plan: user.agentProfile.plan }
        : null,
    };
  });

  return NextResponse.json({
    ok: true,
    users: rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: { all: countAll, license: countLicense, agent: countAgent, none: countNone },
  });
}
