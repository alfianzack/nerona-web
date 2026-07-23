// Simple in-memory fixed-window rate limiter.
//
// NOTE (not deployed yet): this store lives in the Node process, so it resets on
// restart and is NOT shared across multiple instances or serverless functions.
// It is sufficient for a single-server (PM2 + Caddy) deployment. When moving to
// multi-instance or serverless, replace `hit()` with a shared store such as
// Upstash Redis (`@upstash/ratelimit`) — the exported interface can stay the same.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map does not grow unbounded.
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Record one hit against `key` and report whether it is within `limit` per
 * `windowMs`. Callers should reject with HTTP 429 when `ok` is false.
 */
export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds };
}

/** Best-effort client IP from proxy headers (Caddy sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // First entry is the original client.
    return forwarded.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// Named presets so limits are declared in one place.
export const RATE_LIMITS = {
  // Sensitive account actions: 5 attempts per 10 minutes per IP.
  accountAction: { limit: 5, windowMs: 10 * 60 * 1000 },
  // Login is a bit more forgiving to tolerate typos: 10 per 10 minutes per IP.
  login: { limit: 10, windowMs: 10 * 60 * 1000 },
} as const;

/**
 * Convenience wrapper: rate-limit a Request by IP under a named scope.
 * Returns null when allowed, or a RateLimitResult when the caller should reject.
 */
export function limitByIp(
  request: Request,
  scope: string,
  preset: { limit: number; windowMs: number }
): RateLimitResult | null {
  const result = hit(`${scope}:${clientIp(request)}`, preset.limit, preset.windowMs);
  return result.ok ? null : result;
}

/** JSON 429 response body + headers helper for route handlers. */
export function tooManyRequests(result: RateLimitResult, message: string) {
  return {
    body: { ok: false, message },
    init: {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  };
}
