import type { IconName } from "@/components/ui/icons";

export type NavItem = { href: string; label: string };
// Sidebar items carry a glyph for the collapsed 56px strip. Requiring it here
// means an item with no icon cannot compile into a sidebar section.
export type SidebarItem = NavItem & { icon: IconName };
export type NavSection = { title?: string; items: SidebarItem[] };

// Public marketing pages. Text-only — that is why NavItem stays separate from
// SidebarItem. "Home" is deliberately absent — the logo is the home link.
// "Harga" is back after plan 2026-07-19 dropped it from the top nav: that
// decision relied on an in-page PricingTeaser component which no longer
// exists, leaving /metadata and /agent with no pricing path at all.
export const MARKETING_NAV: NavItem[] = [
  { href: "/agent", label: "Agent" },
  { href: "/metadata", label: "Metadata" },
  { href: "/pricing", label: "Harga" },
];

// The tenant app sidebar. "Toko" is the tenant's OWN shop — products they
// sell and orders they receive. "Akun & Tagihan" is their billing
// relationship with Nerona. The old flat CUSTOMER_NAV put /transaksi and
// /finance side by side, which read as one thing; keeping them apart is the
// point of this grouping.
export const TENANT_NAV: NavSection[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: "chart" }] },
  {
    title: "Agent",
    items: [
      { href: "/agent/chat", label: "Chat", icon: "chat" },
      { href: "/agent/dashboard", label: "Koneksi WhatsApp", icon: "link" },
    ],
  },
  {
    title: "Metadata",
    // Bukan "/metadata" — path itu sudah dipakai halaman marketing publik.
    items: [{ href: "/riwayat-metadata", label: "Riwayat", icon: "clock" }],
  },
  {
    title: "Toko",
    items: [
      { href: "/produk", label: "Produk", icon: "box" },
      { href: "/transaksi", label: "Transaksi", icon: "receipt" },
    ],
  },
  {
    title: "Akun & Tagihan",
    items: [
      { href: "/paket", label: "Paket & Harga", icon: "tag" },
      { href: "/finance", label: "Finance", icon: "wallet" },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: "chart" }] },
  {
    title: "Kelola",
    items: [
      { href: "/admin/users", label: "Pengguna", icon: "users" },
      { href: "/admin/orders", label: "Order", icon: "receipt" },
      { href: "/admin/metadata", label: "Metadata", icon: "clock" },
    ],
  },
  {
    title: "Sistem",
    items: [{ href: "/admin/pengaturan", label: "Pengaturan", icon: "settings" }],
  },
];

// App pages reachable from inside the shell but deliberately kept out of the
// sidebar: /profile lives in the account dropdown, and the order flow is
// entered from /paket. They still need a topbar label.
const TITLE_OVERRIDES: NavItem[] = [
  { href: "/order", label: "Order" },
  { href: "/profile", label: "Profile" },
  { href: "/account", label: "Profile" },
];

export function flatten(sections: NavSection[]): SidebarItem[] {
  return sections.flatMap((section) => section.items);
}

function matches(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) || href === "/";
}

// The active item is the longest matching href, so "/admin" doesn't stay
// highlighted on "/admin/users" and "/" only wins when nothing else matches.
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (matches(pathname, item.href) && (best === null || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

// Label for the app topbar. Rendered as a locator, never as a heading — the
// pages own their <h1>.
export function pageTitle(pathname: string, sections: NavSection[]): string {
  const items = [...flatten(sections), ...TITLE_OVERRIDES];
  const active = activeHref(pathname, items);
  return items.find((item) => item.href === active)?.label ?? "Nerona";
}
