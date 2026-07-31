"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { activeHref, type NavItem } from "@/lib/nav";

export function MarketingNavLinks({
  items,
  dashboardHref,
}: {
  items: NavItem[];
  dashboardHref: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname, items);

  // Signed-in visitors keep full access to the marketing pages, so the auth
  // area becomes a way back in rather than a redirect. (/pricing is the one
  // exception — it hands tenants over to /paket, where the sidebar is.)
  // Bar-nya navy-900, jadi setiap warna di sini terang: teks gelap warisan
  // lama tidak akan terlihat sama sekali di atasnya.
  const authArea = dashboardHref ? (
    <Link
      href={dashboardHref}
      className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20"
    >
      Dashboard →
    </Link>
  ) : (
    <>
      <Link href="/login" className="text-xs text-navy-100 transition hover:text-white">
        Masuk
      </Link>
      <Link
        href="/register"
        className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-xs font-semibold text-navy-900 transition hover:brightness-110"
      >
        Coba Gratis
      </Link>
    </>
  );

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-7 sm:flex">
        {items.map((item) => {
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`text-xs transition ${
                isActive
                  ? "-mb-px border-b-2 border-brand-sky pb-px font-semibold text-white"
                  : "text-navy-100 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {authArea}
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white ring-1 ring-white/15 transition hover:bg-white/10 sm:hidden"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          {open ? "✕" : "☰"}
        </span>
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-12 border-b border-white/10 bg-navy-900/95 shadow-lg shadow-navy-900/40 backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={item.href === active ? "page" : undefined}
                className={`rounded-lg px-2 py-2 text-sm transition hover:bg-white/10 ${
                  item.href === active
                    ? "bg-white/10 font-semibold text-white"
                    : "text-navy-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-white/10 pt-3">
              {authArea}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
