import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const footerLink = "transition hover:text-brand-blue";

export async function Footer() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return null;
  }

  return (
    <footer className="border-t border-navy-900/10 bg-canvas px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
          <img src="/logo-nerona.svg" alt="" className="h-5 w-5" />
          Nerona
        </p>
        <p className="mt-1 text-xs text-muted">
          Alat AI untuk kontributor stock dan pemilik bisnis.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
          <Link href="/" className={footerLink}>
            Home
          </Link>
          <Link href="/agent" className={footerLink}>
            Agent
          </Link>
          <Link href="/metadata" className={footerLink}>
            Metadata
          </Link>
          {/* Learn is temporarily hidden — uncomment to re-enable (also remove the /learn redirect in next.config.mjs)
          <Link href="/learn" className={footerLink}>
            Learn
          </Link>
          */}
          <Link href="/login" className={footerLink}>
            Sign In
          </Link>
        </div>
        <p className="mt-6 border-t border-navy-900/10 pt-6 text-xs text-muted/70">
          &copy; {new Date().getFullYear()} Nerona. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
