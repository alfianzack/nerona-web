import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const footerLink = "transition hover:text-brand-blue";

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/agent", label: "Agent" },
  { href: "/metadata", label: "Metadata" },
  { href: "/pricing", label: "Harga" },
  { href: "/login", label: "Masuk" },
];

export async function Footer() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return null;
  }

  return (
    <footer className="border-t border-navy-900/10 bg-canvas px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
          <img src="/logo-nerona.svg" alt="" className="h-5 w-5" />
          Nerona
        </p>
        <p className="mt-2 max-w-md text-xs text-muted">
          Alat AI untuk kontributor stock dan pemilik bisnis.
        </p>
        <nav className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={footerLink}>
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-8 text-xs text-muted/70">
          &copy; {new Date().getFullYear()} Nerona. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
