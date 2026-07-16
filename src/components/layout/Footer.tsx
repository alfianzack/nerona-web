import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
      <p className="font-semibold text-gray-900 dark:text-white">Nerona</p>
      <p className="mt-2">&copy; {new Date().getFullYear()} Nerona. All rights reserved.</p>
      <div className="mt-4 flex justify-center gap-4">
        <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white">
          Pricing
        </Link>
        <Link href="/login" className="hover:text-gray-900 dark:hover:text-white">
          Sign in
        </Link>
      </div>
    </footer>
  );
}
