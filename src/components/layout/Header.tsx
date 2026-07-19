import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const navLink =
  "text-xs text-gray-800 transition hover:text-gray-950 dark:text-gray-300 dark:hover:text-white";

export async function Header() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-950/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/70">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-gray-950 dark:text-white"
        >
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
                className="rounded-full bg-gray-950 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
              >
                Sign Out
              </a>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
