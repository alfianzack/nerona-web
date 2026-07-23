import { describe, expect, it } from "vitest";
import { hit } from "@/lib/rate-limit";

describe("hit (rate limiter)", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = "test:allow-then-block";
    expect(hit(key, 3, 60_000).ok).toBe(true);
    expect(hit(key, 3, 60_000).ok).toBe(true);
    expect(hit(key, 3, 60_000).ok).toBe(true);
    const blocked = hit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports decreasing remaining count", () => {
    const key = "test:remaining";
    expect(hit(key, 5, 60_000).remaining).toBe(4);
    expect(hit(key, 5, 60_000).remaining).toBe(3);
  });

  it("isolates buckets by key", () => {
    expect(hit("test:iso-a", 1, 60_000).ok).toBe(true);
    expect(hit("test:iso-a", 1, 60_000).ok).toBe(false);
    // A different key is unaffected.
    expect(hit("test:iso-b", 1, 60_000).ok).toBe(true);
  });

  it("resets the window once it has elapsed", () => {
    const key = "test:window-reset";
    expect(hit(key, 1, 1).ok).toBe(true);
    expect(hit(key, 1, 1).ok).toBe(false);
    // A 0ms-remaining window: wait past it, then a fresh window should open.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(hit(key, 1, 1).ok).toBe(true);
        resolve();
      }, 5);
    });
  });
});
