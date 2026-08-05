import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type IssuedToken = { id: string; token: string };

/**
 * Mint a token and return its id alongside the secret.
 *
 * The id matters because the caller may have to take the credential back: the
 * dashboard hands the token to the extension over postMessage and gets no
 * guarantee of an answer, so when the handshake times out it has to revoke what
 * it just created. Without the id there is nothing to revoke — the row is a
 * full-access credential nobody holds, and the user cannot tell it apart from a
 * live one in the device list.
 *
 * `replaceSameLabel` first deletes the user's tokens carrying that exact label.
 * The extension stores exactly ONE token, so a second "Hubungkan" from the same
 * browser orphans the first one the moment it is issued; same label means same
 * device and same browser, which is precisely the row that just became dead.
 */
export async function issueExtensionToken(
  userId: string,
  label?: string,
  options: { replaceSameLabel?: boolean } = {}
): Promise<IssuedToken> {
  if (options.replaceSameLabel && label) {
    await prisma.extensionToken.deleteMany({ where: { userId, label } });
  }
  const token = `nrx_${randomBytes(24).toString("hex")}`;
  const row = await prisma.extensionToken.create({
    data: { userId, token, label: label ?? null },
    select: { id: true },
  });
  return { id: row.id, token };
}

export async function createExtensionToken(userId: string, label?: string): Promise<string> {
  return (await issueExtensionToken(userId, label)).token;
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
