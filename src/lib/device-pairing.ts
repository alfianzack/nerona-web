import { randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { createExtensionToken } from "@/lib/extension-auth";

export const PAIRING_TTL_MS = 10 * 60 * 1000;

// Base32 tanpa 0 O 1 I L: kode ini dibaca mata lalu dicocokkan dengan layar
// lain, jadi setiap pasang huruf yang mirip adalah kegagalan pencocokan.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function makeCode(): string {
  // randomInt(0, n) uniform atas [0, n) — beda dengan `byte % n` yang bias
  // saat 256 bukan kelipatan panjang alfabet (31 huruf). Kode ini dibandingkan
  // manusia dengan layar lain, jadi distribusi yang tidak rata membuat sebagian
  // huruf tampak "lebih sering" tanpa alasan yang semestinya.
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeCode(input: string): string {
  return input.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export type StartResult = { code: string; deviceSecret: string; expiresAt: Date };

export async function startPairing(input: { kind: string; label: string }): Promise<StartResult> {
  const code = makeCode();
  const deviceSecret = `nrd_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await prisma.devicePairing.create({
    data: { code, deviceSecret, kind: input.kind, label: input.label, status: "pending", expiresAt },
  });
  return { code, deviceSecret, expiresAt };
}

export type ApproveResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "already_handled" };

export async function approvePairing(input: {
  userId: string;
  code: string;
  setuju: boolean;
}): Promise<ApproveResult> {
  const code = normalizeCode(input.code);
  const row = await prisma.devicePairing.findUnique({ where: { code } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "pending") return { ok: false, reason: "already_handled" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  if (!input.setuju) {
    await prisma.devicePairing.update({ where: { id: row.id }, data: { status: "denied" } });
    return { ok: true };
  }

  const token = await createExtensionToken(input.userId, row.label);
  const created = await prisma.extensionToken.findUnique({ where: { token }, select: { id: true } });
  await prisma.devicePairing.update({
    where: { id: row.id },
    data: { status: "approved", userId: input.userId, tokenId: created?.id ?? null, approvedAt: new Date() },
  });
  return { ok: true };
}

export type ClaimResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "approved"; token: string }
  | { status: "not_found" };

/**
 * Menyerahkan token TEPAT SEKALI.
 *
 * `updateMany` dengan penjaga `status: "approved"` adalah operasi tunggal di
 * basis data, jadi dua klaim bersamaan hanya membuat salah satunya mendapat
 * `count === 1`. Tanpa penjaga itu, balasan poll yang terekam bisa diputar
 * ulang untuk mengambil token yang sama.
 */
export async function claimPairing(deviceSecret: string): Promise<ClaimResult> {
  const claimed = await prisma.devicePairing.updateMany({
    where: { deviceSecret, status: "approved" },
    data: { status: "claimed" },
  });

  const row = await prisma.devicePairing.findUnique({
    where: { deviceSecret },
    include: { token: { select: { token: true } } },
  });
  if (!row) return { status: "not_found" };

  if (claimed.count === 1) {
    if (!row.token) return { status: "expired" };
    return { status: "approved", token: row.token.token };
  }

  if (row.status === "denied") return { status: "denied" };
  if (row.status === "pending" && row.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  return { status: "pending" };
}
