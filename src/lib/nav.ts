import type { IconName } from "@/components/ui/icons";
import { AGENT_ENABLED } from "@/lib/features";

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
//
// With agent hidden, "/" IS the metadata sales page, so a "Metadata" item
// would point at the page the visitor is standing on. It is replaced by
// in-page anchors to that page's sections. "Harga" keeps pointing at
// /pricing rather than the landing's own pricing block, because /pricing is
// the only place the 3/6/12-month duration switcher lives.
export function marketingNav(agentEnabled: boolean): NavItem[] {
  if (!agentEnabled) {
    return [
      { href: "/#fitur", label: "Fitur" },
      { href: "/pricing", label: "Harga" },
      { href: "/#faq", label: "FAQ" },
    ];
  }
  return [
    { href: "/agent", label: "Agent" },
    { href: "/metadata", label: "Metadata" },
    { href: "/pricing", label: "Harga" },
  ];
}

// The tenant app sidebar. "Toko" is the tenant's OWN shop — products they
// sell and orders they receive. "Akun & Tagihan" is their billing
// relationship with Nerona. The old flat CUSTOMER_NAV put /transaksi and
// /finance side by side, which read as one thing; keeping them apart is the
// point of this grouping.
//
// Agent and Toko are one world, so they are hidden together: the shop exists
// to be operated by the agent through add_product and record_sale, and
// without it those pages are manual bookkeeping. The pages and their queries
// stay in the codebase, just unreachable.
export function tenantNav(agentEnabled: boolean): NavSection[] {
  const sections: NavSection[] = [
    { items: [{ href: "/dashboard", label: "Dashboard", icon: "chart" }] },
  ];

  if (agentEnabled) {
    sections.push({
      title: "Agent",
      items: [
        { href: "/agent/chat", label: "Chat", icon: "chat" },
        { href: "/agent/dashboard", label: "Koneksi WhatsApp", icon: "link" },
      ],
    });
  }

  sections.push({
    title: "Metadata",
    // Bukan "/metadata" — path itu sudah dipakai halaman marketing publik.
    // "Unduh & Pasang" ada di sini, bukan di "Akun & Tagihan": isinya kedua
    // alat metadata (extension + Hub), bukan hubungan tagihan dengan Nerona.
    items: [
      { href: "/riwayat-metadata", label: "Riwayat", icon: "clock" },
      { href: "/unduh", label: "Unduh & Pasang", icon: "download" },
    ],
  });

  if (agentEnabled) {
    sections.push({
      title: "Toko",
      items: [
        { href: "/produk", label: "Produk", icon: "box" },
        { href: "/transaksi", label: "Transaksi", icon: "receipt" },
      ],
    });
  }

  sections.push({
    title: "Akun & Tagihan",
    items: [
      { href: "/paket", label: "Paket & Harga", icon: "tag" },
      { href: "/finance", label: "Finance", icon: "wallet" },
    ],
  });

  return sections;
}

export const MARKETING_NAV: NavItem[] = marketingNav(AGENT_ENABLED);
export const TENANT_NAV: NavSection[] = tenantNav(AGENT_ENABLED);

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
