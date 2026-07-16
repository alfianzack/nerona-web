import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function Header() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
        >
          Nerona
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/pricing"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            Pricing
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/account"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Account
              </Link>
              <a href="/api/auth/signout" className="font-medium text-gray-900 dark:text-white">
                Sign out
              </a>
            </>
          ) : (
            <Link href="/login" className="font-medium text-gray-900 dark:text-white">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
