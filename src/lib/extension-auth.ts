import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function createExtensionToken(userId: string, label?: string): Promise<string> {
  const token = `nrx_${randomBytes(24).toString("hex")}`;
  await prisma.extensionToken.create({ data: { userId, token, label: label ?? null } });
  return token;
}

export async function resolveExtensionToken(token: string): Promise<{ userId: string } | null> {
  if (!token) return null;
  const row = await prisma.extensionToken.findUnique({
    where: { token },
    select: { id: true, userId: true },
  });
  if (!row) return null;
  await prisma.extensionToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: row.userId };
}

export async function listExtensionTokens(userId: string) {
  return prisma.extensionToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeExtensionToken(userId: string, id: string): Promise<boolean> {
  const res = await prisma.extensionToken.deleteMany({ where: { id, userId } });
  return res.count > 0;
}
