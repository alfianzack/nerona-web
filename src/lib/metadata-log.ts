import { prisma } from "@/lib/prisma";

/**
 * Riwayat metadata yang di-generate extension.
 *
 * Semua batas di bawah adalah pemotongan diam-diam, bukan penolakan: satu URL
 * kepanjangan atau judul aneh tidak boleh membuat generate yang sudah berhasil
 * terlihat gagal di mata user. Yang ditolak hanya baris yang tidak ada isinya.
 */
const MAX_URL = 500;
const MAX_TITLE = 300;
const MAX_KEYWORDS = 4000;
const MAX_MARKETPLACE = 40;

export interface RecordMetadataLogInput {
  userId: string;
  marketplace: unknown;
  pageUrl: unknown;
  title: unknown;
  /** Array atau string dipisah koma — keduanya berakhir sebagai satu string. */
  keywords: unknown;
}

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

/**
 * Keyword disimpan sebagai satu teks. Sumbernya bisa array (JSON dari extension)
 * atau string yang sudah dipisah koma; dua-duanya dinormalkan ke bentuk yang sama
 * supaya kolomnya bisa disalin apa adanya ke form marketplace.
 */
export function normalizeKeywords(value: unknown): { text: string; count: number } {
  const parts = (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((part) => String(part).trim())
    .filter(Boolean);

  // Duplikat dibuang dengan perbandingan case-insensitive, tapi yang disimpan
  // adalah ejaan pertama yang muncul — urutan keyword itu bermakna di stock.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }

  let joined = unique.join(", ");
  if (joined.length > MAX_KEYWORDS) {
    // Potong di batas keyword, jangan di tengah kata.
    joined = joined.slice(0, MAX_KEYWORDS);
    joined = joined.slice(0, joined.lastIndexOf(", ")).trim();
  }
  return { text: joined, count: joined ? joined.split(", ").length : 0 };
}

/** Mengembalikan baris yang tersimpan, atau null kalau tidak ada yang layak dicatat. */
export async function recordMetadataLog(input: RecordMetadataLogInput) {
  const keywords = normalizeKeywords(input.keywords);
  const title = text(input.title, MAX_TITLE);
  if (!title && !keywords.text) return null;

  return prisma.metadataLog.create({
    data: {
      userId: input.userId,
      marketplace: text(input.marketplace, MAX_MARKETPLACE).toLowerCase() || "unknown",
      pageUrl: text(input.pageUrl, MAX_URL),
      title,
      keywords: keywords.text,
      keywordCount: keywords.count,
    },
  });
}

export interface MetadataLogStats {
  total: number;
  last7Days: number;
  perMarketplace: { marketplace: string; count: number }[];
}

/** `userId` null = lingkup admin (semua tenant). */
export async function getMetadataLogStats(userId: string | null): Promise<MetadataLogStats> {
  const where = userId ? { userId } : {};
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [total, last7Days, grouped] = await Promise.all([
    prisma.metadataLog.count({ where }),
    prisma.metadataLog.count({ where: { ...where, createdAt: { gte: since } } }),
    prisma.metadataLog.groupBy({
      by: ["marketplace"],
      where,
      _count: { _all: true },
      orderBy: { _count: { marketplace: "desc" } },
    }),
  ]);
  return {
    total,
    last7Days,
    perMarketplace: grouped.map((row) => ({
      marketplace: row.marketplace,
      count: row._count._all,
    })),
  };
}

// Dua fungsi terpisah, bukan satu dengan `include` bersyarat: hanya daftar admin
// yang membawa pemilik baris, dan menyatukannya membuat tipe hasilnya melebur
// jadi union yang tidak bisa dipakai langsung di halaman.
export async function listMetadataLogsForUser(userId: string, limit = 100) {
  return prisma.metadataLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listAllMetadataLogs(limit = 100) {
  return prisma.metadataLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true, name: true } } },
  });
}
