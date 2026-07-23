// Asia/Jakarta is a fixed UTC+7 offset (no DST).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// The UTC instant of the first moment of NEXT month in WIB. A monthly package
// activated at `now` is valid while `now < monthlyExpiryFrom(now)`.
export function monthlyExpiryFrom(now: Date): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const boundaryUtcMs = Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - WIB_OFFSET_MS;
  return new Date(boundaryUtcMs);
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt != null && now.getTime() >= expiresAt.getTime();
}
