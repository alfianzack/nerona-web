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
  | { ok: false; reason: "not_found" | "expired" | "already_handled" | "plan_required" };

/**
 * Apakah lisensi orang ini menyertakan Nerona Hub.
 *
 * Yang dibaca kolom `hub` di lisensi, BUKAN nama paketnya. Nama dipakai di
 * banyak tempat (`PAID_PLAN_NAMES`, label harga, judul di dasbor) dan sekali
 * waktu akan diganti; kolom bendera tidak ikut bergeser saat itu terjadi.
 */
export async function lisensiBolehHub(userId: string): Promise<boolean> {
  const license = await prisma.license.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { hub: true },
  });
  return Boolean(license?.hub);
}

/**
 * Mencabut seluruh token yang lahir dari penyambungan Hub milik satu akun.
 *
 * Sasarannya lewat relasi `DevicePairing` (`kind = "hub"`), BUKAN pencocokan
 * teks label. Label adalah kolom bebas: token extension yang kebetulan
 * bernama mirip tidak boleh ikut tercabut, dan pengguna bisa saja menamai
 * perangkatnya apa pun kelak.
 *
 * Mengembalikan jumlah token yang tercabut. Aman dijalankan berkali-kali.
 */
export async function revokeHubTokens(userId: string): Promise<number> {
  const pairings = await prisma.devicePairing.findMany({
    where: { userId, kind: "hub", tokenId: { not: null } },
    select: { tokenId: true },
  });
  const ids = pairings.map((p) => p.tokenId).filter((id): id is string => Boolean(id));
  if (!ids.length) return 0;

  // `userId` ikut di filter meski id token sudah spesifik: dua penjaga lebih
  // murah daripada satu baris pairing yang datanya melenceng.
  const removed = await prisma.extensionToken.deleteMany({
    where: { id: { in: ids }, userId },
  });
  return removed.count;
}

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

  // Gerbang paket, DI SINI dan bukan di rutenya: `userId` pada titik ini sudah
  // dipastikan berasal dari sesi, dan tokennya dicetak di baris berikutnya —
  // jadi tidak ada jalan mencetak token Hub yang melewati pemeriksaan ini.
  //
  // Pairing extension tidak tersentuh: hanya `kind === "hub"` yang diperiksa.
  if (row.kind === "hub" && !(await lisensiBolehHub(input.userId))) {
    // Statusnya DITULIS, tidak sekadar dikembalikan sebagai galat. Tanpa ini
    // barisnya tetap `pending`, Hub terus polling sampai kodenya kedaluwarsa,
    // lalu melapor "kode kedaluwarsa" — pesan yang menunjuk sebab yang salah.
    await prisma.devicePairing.update({
      where: { id: row.id },
      data: { status: "plan_required" },
    });
    return { ok: false, reason: "plan_required" };
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
  // Dipisah dari `denied`: "Anda menekan Tolak" dan "paket Anda tidak
  // menyertakan Hub" menuntut tindakan yang berbeda, dan menyamakannya membuat
  // pengguna mencoba lagi dengan kode baru yang dijamin gagal sama.
  | { status: "plan_required" }
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
  if (row.status === "plan_required") return { status: "plan_required" };
  if (row.status === "pending" && row.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  return { status: "pending" };
}
