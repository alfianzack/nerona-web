import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { INSTALLATION_SEPARATOR, instalasiSah } from "@/lib/device-label";

export type IssuedToken = { id: string; token: string };

// The id lives inside `label` because `label` is the only free-form column on
// `ExtensionToken`, and giving it a column of its own would mean a migration
// against live production data for a string that only this one flow reads.
// Its shape and separator live in `device-label.ts` so the client that BUILDS
// the label and the server that MATCHES it cannot drift apart.

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
 * `replaceInstallation` is an extension INSTALLATION id, not a label. The
 * extension stores exactly ONE token, so a second "Hubungkan" from the same
 * installation orphans the first one the moment it is issued — but "same
 * installation" is the only scope where that is true. Scoping this by label
 * instead would be actively destructive: `namaBrowser()` only ever yields
 * Chrome / Edge / Opera / Browser, so the office PC, the home PC and a second
 * Chrome profile all produce the identical label, and revoking by label would
 * silently kill another machine's working token with nothing in the device list
 * to say which one just lost access.
 *
 * An absent or empty id revokes NOTHING. That direction is deliberate: an old
 * extension build cannot supply an id, and leaving an idle token behind is far
 * cheaper than deleting a credential someone is actively using.
 */
export async function issueExtensionToken(
  userId: string,
  label?: string,
  options: { replaceInstallation?: string } = {}
): Promise<IssuedToken> {
  // Divalidasi lagi di sini, bukan hanya di rute pemanggilnya: fungsi ini yang
  // menyusun filter penghapusan, jadi ia yang harus memastikan bentuknya — dan
  // pemanggil berikutnya belum tentu memvalidasi apa pun.
  const installation = instalasiSah(options.replaceInstallation ?? null);
  if (installation) {
    // `endsWith` on the id, not an exact label match: the readable prefix may
    // legitimately change for one installation (a better user-agent sniff, a
    // browser renaming itself) while the id stays put. The id is unique per
    // installation, so the scope is the same either way.
    await prisma.extensionToken.deleteMany({
      where: { userId, label: { endsWith: `${INSTALLATION_SEPARATOR}${installation}` } },
    });
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
