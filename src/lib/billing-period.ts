// Asia/Jakarta is a fixed UTC+7 offset (no DST).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt != null && now.getTime() >= expiresAt.getTime();
}

/**
 * `months` calendar months after `base`, in WIB. Date.UTC normalizes overflow,
 * so 31 Jan + 1 month lands on 3 March rather than throwing — the same rule the
 * single-month version always had.
 */
export function addMonthsJakarta(base: Date, months: number): Date {
  const wib = new Date(base.getTime() + WIB_OFFSET_MS);
  const utcMs =
    Date.UTC(
      wib.getUTCFullYear(),
      wib.getUTCMonth() + months,
      wib.getUTCDate(),
      wib.getUTCHours(),
      wib.getUTCMinutes(),
      wib.getUTCSeconds(),
      wib.getUTCMilliseconds()
    ) - WIB_OFFSET_MS;
  return new Date(utcMs);
}

/** Kept for readability at the many single-month call sites. */
export function addOneMonthJakarta(base: Date): Date {
  return addMonthsJakarta(base, 1);
}

/**
 * Masa aktif untuk aktivasi pertama: `months` bulan penuh sejak saat dibayar.
 *
 * Sebelumnya ini dipatok ke awal bulan berikutnya, sehingga aktivasi tanggal 28
 * hanya berumur beberapa hari padahal ditagih satu bulan. Perpanjangan tidak
 * pernah ikut aturan itu (lihat renewedExpiryFrom), jadi dua jalur pembayaran
 * memberi masa aktif yang berbeda untuk harga yang sama.
 */
export function activationExpiryFrom(now: Date, months = 1): Date {
  return addMonthsJakarta(now, months);
}

/**
 * Forward-stacking renewal: extend from the remaining time if still active,
 * else from now. `months` is the duration the tenant bought — a 6-month package
 * renews for another 6 months, not for one.
 */
export function renewedExpiryFrom(currentExpiry: Date | null, now: Date, months = 1): Date {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return addMonthsJakarta(base, months);
}
