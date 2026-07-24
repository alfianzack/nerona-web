import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/points";

export interface ExtensionAccountState {
  email: string;
  plan: string | null;
  licenseStatus: string | null;
  validUntil: Date | null;
  marketplaces: string;
  rejectAnalyzer: boolean;
  pointsBalance: number;
  active: boolean;
}

export async function getExtensionAccountState(
  userId: string,
  now: Date = new Date()
): Promise<ExtensionAccountState> {
  const [user, license, pointsBalance] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.license.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { plan: true } }),
    getBalance(userId),
  ]);
  const validUntil = license?.validUntil ?? null;
  const active =
    !!license &&
    ["active", "comp"].includes(license.status) &&
    (validUntil == null || validUntil.getTime() > now.getTime());
  return {
    email: user?.email ?? "",
    plan: license?.plan?.name ?? null,
    licenseStatus: license?.status ?? null,
    validUntil,
    marketplaces: license?.marketplaces ?? "*",
    rejectAnalyzer: license?.rejectAnalyzer ?? false,
    pointsBalance,
    active,
  };
}
