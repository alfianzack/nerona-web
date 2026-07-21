import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const navLink = "text-xs text-ink transition hover:text-brand-blue";

type NavItem = { href: string; label: string };

const GUEST_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/agent", label: "Agent" },
  { href: "/metadata", label: "Metadata" },
];

const CUSTOMER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/produk", label: "Produk" },
  { href: "/transaksi", label: "Transaksi" },
  { href: "/profile", label: "Profile" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Pengguna" },
  { href: "/admin/orders", label: "Order" },
  { href: "/admin/pengaturan", label: "Pengaturan" },
];

export async function Header() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = Boolean(session?.user);
  const isAdmin = Boolean(session?.user?.role);

  const items = !isLoggedIn ? GUEST_NAV : isAdmin ? ADMIN_NAV : CUSTOMER_NAV;

  return (
    <header className="sticky top-0 z-50 border-b border-navy-900/10 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link
          href={isAdmin ? "/admin" : "/"}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"
        >
          <img src="/logo-nerona.svg" alt="" className="h-5 w-5" />
          Nerona
        </Link>
        <nav className="flex items-center gap-7">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={navLink}>
              {item.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <a
              href="/api/auth/signout"
              className="rounded-full bg-navy-900/5 px-3.5 py-1.5 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Sign Out
            </a>
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
