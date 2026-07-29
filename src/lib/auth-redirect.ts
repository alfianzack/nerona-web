// Where a user belongs immediately after signing in. Admins have no personal
// tenant dashboard, so sending them to /dashboard lands them on a page whose
// nav does not even contain it.
export function homeForRole(user: { role?: string | null }): string {
  return user.role ? "/admin" : "/dashboard";
}

// Only same-origin absolute paths survive.
//
// "//evil.com" and "/\evil.com" are read by browsers as protocol-relative
// URLs pointing at another host, so a startsWith("/") check on its own is an
// open redirect. "/post-login" is refused separately because feeding the
// landing route back to itself can loop.
export function safeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw === "/post-login" || raw.startsWith("/post-login?")) return null;
  return raw;
}
