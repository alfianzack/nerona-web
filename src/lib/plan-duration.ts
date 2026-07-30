import { prisma } from "@/lib/prisma";

/**
 * Durasi paket yang bisa dibeli, dan diskon untuk yang lebih panjang.
 *
 * Harga hanya disimpan sekali — harga BULANAN. Harga 3/6/12 bulan dihitung dari
 * situ, jadi menaikkan harga cukup mengubah satu angka dan semua durasi ikut.
 * Diskonnya sendiri diatur owner di Pengaturan, rantainya sama dengan setelan
 * lain di proyek ini: DB → env → default kode.
 */
export const PLAN_DURATIONS = [1, 3, 6, 12] as const;
export type PlanDuration = (typeof PLAN_DURATIONS)[number];

export const DEFAULT_DURATION_DISCOUNTS: Record<number, number> = {
  1: 0,
  3: 5,
  6: 10,
  12: 20,
};

export const DURATION_LABELS: Record<number, string> = {
  1: "1 bulan",
  3: "3 bulan",
  6: "6 bulan",
  12: "1 tahun",
};

export function isPlanDuration(value: unknown): value is PlanDuration {
  return PLAN_DURATIONS.includes(Number(value) as PlanDuration);
}

/** Membulatkan apa pun ke durasi sah; 1 bulan saat tidak dikenali. */
export function coerceDuration(value: unknown): PlanDuration {
  return isPlanDuration(value) ? (Number(value) as PlanDuration) : 1;
}

export function durationSettingKey(months: number): string {
  return `duration_discount_${months}`;
}

function envKey(months: number): string {
  return `DURATION_DISCOUNT_${months}`;
}

/**
 * Diskon sah hanya kalau angka berhingga 0–100. Kosong, negatif, dan di atas
 * 100 dianggap belum diatur — aturan yang sama dipakai ai-settings.ts. Nol itu
 * sah (tanpa diskon) dan tidak boleh terbaca sebagai belum diatur.
 */
function parseDiscount(raw: string | undefined): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export async function getDurationDiscounts(): Promise<Record<number, number>> {
  const keys = PLAN_DURATIONS.map(durationSettingKey);
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  const out: Record<number, number> = {};
  for (const months of PLAN_DURATIONS) {
    out[months] =
      parseDiscount(stored.get(durationSettingKey(months))) ??
      parseDiscount(process.env[envKey(months)]) ??
      DEFAULT_DURATION_DISCOUNTS[months];
  }
  // 1 bulan adalah harga dasar. Diskon di sana akan membuat "harga bulanan"
  // yang diatur owner bukan lagi harga yang dibayar, jadi selalu dipaksa nol.
  out[1] = 0;
  return out;
}

export async function updateDurationDiscount(months: number, value: string): Promise<boolean> {
  if (!isPlanDuration(months) || months === 1) return false;
  const key = durationSettingKey(months);
  const trimmed = value.trim();
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: trimmed },
    update: { value: trimmed },
  });
  return true;
}

/**
 * Total yang dibayar untuk satu durasi, sudah termasuk diskon.
 *
 * Dibulatkan ke ribuan terdekat supaya harga yang tampil rapi — "Rp 534.600"
 * dari 6 × 99.000 − 10% bukan angka yang dipasang orang di halaman harga.
 */
export function priceForDuration(monthlyPrice: number, months: number, discountPercent: number): number {
  const gross = monthlyPrice * months;
  const net = gross * (1 - discountPercent / 100);
  return Math.round(net / 1000) * 1000;
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/**
 * Label harga untuk halaman pricing dan checkout.
 *
 * `null` berarti harga belum diatur — jangan pernah menampilkan "Rp 0" untuk
 * paket berbayar yang harganya kosong, itu terbaca sebagai gratis.
 */
export function priceLabelFor(monthlyPrice: number | null, months: number, discountPercent: number): string {
  if (monthlyPrice === null) return "Hubungi kami";
  if (monthlyPrice === 0) return "Rp 0";
  const total = priceForDuration(monthlyPrice, months, discountPercent);
  return months === 1
    ? `${formatRupiah(total)}/bulan`
    : `${formatRupiah(total)}/${DURATION_LABELS[months] ?? `${months} bulan`}`;
}

/** Baris kecil di bawah harga: setara per bulan + berapa yang dihemat. */
export function savingsLabelFor(
  monthlyPrice: number | null,
  months: number,
  discountPercent: number
): string | null {
  if (monthlyPrice === null || monthlyPrice === 0 || months === 1) return null;
  const total = priceForDuration(monthlyPrice, months, discountPercent);
  const perMonth = Math.round(total / months);
  const saved = monthlyPrice * months - total;
  if (saved <= 0) return `≈ ${formatRupiah(perMonth)}/bulan`;
  return `≈ ${formatRupiah(perMonth)}/bulan · hemat ${formatRupiah(saved)}`;
}
