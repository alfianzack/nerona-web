/**
 * Whether NextAuth is issuing secure-prefixed cookies for this request.
 *
 * This exists because NextAuth v4 answers that question in two different places
 * with two different rules, and on Vercel they disagree:
 *
 * - The server (`utils/detect-origin.js`) ignores `NEXTAUTH_URL` completely when
 *   `process.env.VERCEL` is set and derives the origin from the forwarded host
 *   and protocol. Behind Vercel's proxy that is https, so it sets
 *   `__Secure-next-auth.session-token`.
 * - `getToken` (`jwt/index.js`) uses
 *   `process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL`.
 *   `??` only falls through on `undefined`, so an `NEXTAUTH_URL` of
 *   `http://localhost:3000` evaluates to `false` rather than deferring to
 *   Vercel — and getToken then looks for the unprefixed `next-auth.session-token`,
 *   which does not exist.
 *
 * The result was an infinite redirect: middleware saw no token and sent /admin
 * to /login, while the (auth) layout read the session fine and sent it straight
 * back. Nothing caught it locally, where `VERCEL` is unset and both rules agree.
 *
 * So: mirror the SERVER's rule and pass the answer to getToken explicitly.
 * Never let getToken fall back to its own default.
 */
export function usesSecureCookies(forwardedProto: string | null): boolean {
  // Same condition detectOrigin uses to decide the request is authoritative.
  if (process.env.VERCEL || process.env.AUTH_TRUST_HOST) {
    // detectOrigin treats anything that is not exactly "http" as https, so a
    // missing header means https rather than defaulting open.
    return forwardedProto !== "http";
  }
  // Self-hosted with no trusted-host flag: NEXTAUTH_URL is the only signal, and
  // local development must stay insecure or dev sign-in breaks.
  return process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
}
