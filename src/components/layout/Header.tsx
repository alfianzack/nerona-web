import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBalance } from "@/lib/points";
import { HeaderNav, type NavItem } from "@/components/layout/HeaderNav";

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

  // Show the tenant's own points balance on every page. Admins use the admin
  // nav and have no personal wallet, so it's tenant-only.
  const points = isLoggedIn && !isAdmin ? await getBalance(session!.user.id) : null;

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
        <HeaderNav items={items} isLoggedIn={isLoggedIn} points={points} />
      </div>
    </header>
  );
}
