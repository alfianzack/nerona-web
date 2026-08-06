import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { usesSecureCookies } from "@/lib/auth-cookies";

const isDev = process.env.NODE_ENV !== "production";

// Build a per-request Content-Security-Policy carrying a fresh nonce. Next.js
// reads this nonce from the request header and stamps it onto its own scripts,
// so `script-src` can stay strict ('self' + nonce + strict-dynamic) without
// 'unsafe-inline'. Third parties are limited to what the app actually uses
// (the Vimeo player embed in the Learn section).
function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://i.vimeocdn.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://vimeo.com https://player.vimeo.com${isDev ? " ws: wss:" : ""}`,
    `frame-src 'self' https://player.vimeo.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ].join("; ");
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Defense-in-depth: block access to admin pages/APIs at the edge, in addition
  // to the per-route session-guards. A future route that forgets its own check
  // is still protected here.
  const isAdminPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isAdminPath) {
    // `secureCookie` is passed explicitly and must stay that way. getToken's own
    // default reads NEXTAUTH_URL and disagrees with the server whenever that
    // value is http:// on a Vercel deployment, which looks for the wrong cookie
    // name and turns this guard into an infinite /admin ↔ /login redirect. See
    // lib/auth-cookies.ts.
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: usesSecureCookies(request.headers.get("x-forwarded-proto")),
    });
    const hasAdminRole = Boolean(token && (token as { role?: unknown }).role);
    if (!hasAdminRole) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Attach CSP with a per-request nonce. The nonce is passed through the request
  // headers so the Next.js renderer can apply it to its inline scripts.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Server components cannot read the request path. requireUser() needs it to
  // build ?callbackUrl= so a deep link survives sign-in.
  // Query string ikut: /hubungkan?kode=... kehilangan kodenya
  // kalau hanya path yang dibawa melewati login.
  requestHeaders.set("x-pathname", pathname + request.nextUrl.search);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js static assets and the favicon, and skip
    // prefetch requests (which do not need a CSP nonce).
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
