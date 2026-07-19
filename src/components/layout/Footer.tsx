import Link from "next/link";

const footerLink = "transition hover:text-gold-400";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy-950 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-tight text-white">Nerona</p>
        <p className="mt-1 text-xs text-navy-300">
          Alat AI untuk kontributor stock dan pemilik bisnis.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-navy-300">
          <Link href="/" className={footerLink}>
            Home
          </Link>
          <Link href="/agent" className={footerLink}>
            Agent
          </Link>
          <Link href="/metadata" className={footerLink}>
            Metadata
          </Link>
          <Link href="/learn" className={footerLink}>
            Learn
          </Link>
          <Link href="/login" className={footerLink}>
            Sign In
          </Link>
        </div>
        <p className="mt-6 border-t border-white/10 pt-6 text-xs text-navy-300/70">
          &copy; {new Date().getFullYear()} Nerona. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
