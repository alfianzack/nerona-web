import { prisma } from "@/lib/prisma";

export type ExtensionConnectionState =
  | { status: "none" }
  | { status: "unused" }
  | { status: "connected"; lastUsedAt: Date };

/**
 * Sudahkah ekstensi orang ini benar-benar terhubung?
 *
 * Membuat token saja tidak cukup — banyak yang membuatnya lalu berhenti
 * sebelum menempelkannya di popup. `lastUsedAt` baru terisi setelah
 * ekstensi memanggil API dengan token itu, jadi itulah bukti pemasangannya
 * selesai. Dipakai dashboard untuk memutuskan seberapa besar panduan
 * pemasangan ditampilkan.
 */
export async function getExtensionConnectionState(
  userId: string
): Promise<ExtensionConnectionState> {
  const tokens = await prisma.extensionToken.findMany({
    where: { userId },
    select: { lastUsedAt: true },
  });

  if (tokens.length === 0) return { status: "none" };

  const used = tokens
    .map((t) => t.lastUsedAt)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime());

  if (used.length === 0) return { status: "unused" };
  return { status: "connected", lastUsedAt: used[0] };
}
