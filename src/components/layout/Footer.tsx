import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-950/5 bg-[#f5f5f7] px-6 py-12 dark:border-white/10 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-tight text-gray-950 dark:text-white">
          Nerona
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Metadata otomatis untuk kontributor stock.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
          <Link href="/" className="transition hover:text-gray-950 dark:hover:text-white">
            Home
          </Link>
          <Link href="/agent" className="transition hover:text-gray-950 dark:hover:text-white">
            Agent
          </Link>
          <Link href="/metadata" className="transition hover:text-gray-950 dark:hover:text-white">
            Metadata
          </Link>
          <Link href="/learn" className="transition hover:text-gray-950 dark:hover:text-white">
            Learn
          </Link>
          <Link href="/login" className="transition hover:text-gray-950 dark:hover:text-white">
            Sign In
          </Link>
        </div>
        <p className="mt-6 border-t border-gray-950/5 pt-6 text-xs text-gray-400 dark:border-white/10 dark:text-gray-500">
          &copy; {new Date().getFullYear()} Nerona. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
