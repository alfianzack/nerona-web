import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";
import { AGENT_ENABLED } from "@/lib/features";

const footerLink = "transition hover:text-brand-blue";

// Dengan agent disembunyikan, "/" ADALAH halaman metadata, jadi kedua
// tautan produk itu menunjuk ke tempat yang sama dengan Home.
const FOOTER_LINKS = AGENT_ENABLED
  ? [
      { href: "/", label: "Home" },
      { href: "/agent", label: "Agent" },
      { href: "/metadata", label: "Metadata" },
      { href: "/pricing", label: "Harga" },
    ]
  : [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Harga" },
    ];

export async function Footer() {
  const session = await getServerSession(authOptions);

  // The footer now lives only in the (marketing) group, so it no longer has to
  // hide itself when signed in. But signed-in visitors do see it on / and
  // /pricing, where a "Masuk" link is nonsense — point them into the app.
  const links = session?.user
    ? [...FOOTER_LINKS, { href: homeForRole(session.user), label: "Dashboard" }]
    : [...FOOTER_LINKS, { href: "/login", label: "Masuk" }];

  return (
    <footer className="border-t border-navy-900/10 bg-canvas px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
          <img src="/logo-nerona.svg" alt="" className="h-5 w-5" />
          Nerona
        </p>
        <p className="mt-2 max-w-md text-xs text-muted">
          {AGENT_ENABLED
            ? "Alat AI untuk kontributor stock dan pemilik bisnis."
            : "Alat AI untuk kontributor stock."}
        </p>
        <nav className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted">
          {links.map((link) => (
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
