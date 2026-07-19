import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const navLink = "text-xs text-navy-100 transition hover:text-gold-400";

export async function Header() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-white">
          Nerona
        </Link>
        <nav className="flex items-center gap-7">
          <Link href="/" className={navLink}>
            Home
          </Link>
          <Link href="/agent" className={navLink}>
            Agent
          </Link>
          <Link href="/metadata" className={navLink}>
            Metadata
          </Link>
          <Link href="/learn" className={navLink}>
            Learn
          </Link>
          {session?.user ? (
            <>
              <Link href="/account" className={navLink}>
                Account
              </Link>
              {session.user.role && (
                <Link href="/admin" className={navLink}>
                  Admin
                </Link>
              )}
              <a
                href="/api/auth/signout"
                className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20"
              >
                Sign Out
              </a>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition hover:brightness-110"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
