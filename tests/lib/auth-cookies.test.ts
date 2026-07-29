import { afterEach, describe, expect, it } from "vitest";
import { usesSecureCookies } from "@/lib/auth-cookies";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

/**
 * Regression guard for the production redirect loop of 2026-07-29.
 *
 * NextAuth reads the session cookie under two different names depending on
 * whether it believes the origin is https: `__Secure-next-auth.session-token`
 * or the bare `next-auth.session-token`. The server derives that from the
 * request (utils/detect-origin.js ignores NEXTAUTH_URL entirely when
 * process.env.VERCEL is set), while `getToken` derives it from
 * `NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL` — and because
 * `??` only falls through on undefined, an NEXTAUTH_URL of "http://localhost:3000"
 * pins getToken to the unprefixed name while the server issues the prefixed one.
 *
 * Middleware then saw no token, redirected /admin to /login, and the (auth)
 * layout saw a perfectly good session and redirected straight back.
 *
 * This helper must mirror the SERVER's rule, so the two can never disagree.
 */
describe("usesSecureCookies", () => {
  describe("on Vercel (or any trusted-host deployment)", () => {
    it("ignores an http NEXTAUTH_URL and trusts the forwarded protocol", () => {
      process.env.VERCEL = "1";
      process.env.NEXTAUTH_URL = "http://localhost:3000";

      // The bug: getToken's own default returns false here, so it looked for
      // `next-auth.session-token` while the server had set `__Secure-...`.
      expect(usesSecureCookies("https")).toBe(true);
    });

    it("ignores a missing NEXTAUTH_URL too", () => {
      process.env.VERCEL = "1";
      delete process.env.NEXTAUTH_URL;

      expect(usesSecureCookies("https")).toBe(true);
    });

    it("honours a genuinely http-forwarded request", () => {
      process.env.VERCEL = "1";

      expect(usesSecureCookies("http")).toBe(false);
    });

    it("treats a missing forwarded protocol as https, matching detectOrigin", () => {
      process.env.VERCEL = "1";

      expect(usesSecureCookies(null)).toBe(true);
    });

    it("applies to a self-hosted deployment that sets AUTH_TRUST_HOST", () => {
      delete process.env.VERCEL;
      process.env.AUTH_TRUST_HOST = "true";
      process.env.NEXTAUTH_URL = "http://localhost:3000";

      expect(usesSecureCookies("https")).toBe(true);
    });
  });

  describe("off Vercel, where NEXTAUTH_URL is authoritative", () => {
    it("follows an https NEXTAUTH_URL", () => {
      delete process.env.VERCEL;
      delete process.env.AUTH_TRUST_HOST;
      process.env.NEXTAUTH_URL = "https://nerona.example.com";

      expect(usesSecureCookies("https")).toBe(true);
    });

    it("stays insecure for local development", () => {
      delete process.env.VERCEL;
      delete process.env.AUTH_TRUST_HOST;
      process.env.NEXTAUTH_URL = "http://localhost:3000";

      // Must remain false or local sign-in breaks: dev issues unprefixed cookies.
      expect(usesSecureCookies("http")).toBe(false);
    });

    it("defaults to insecure when nothing is configured", () => {
      delete process.env.VERCEL;
      delete process.env.AUTH_TRUST_HOST;
      delete process.env.NEXTAUTH_URL;

      expect(usesSecureCookies(null)).toBe(false);
    });
  });
});
