"use client";

import Link from "next/link";
import { useState } from "react";

export type NavItem = { href: string; label: string };

const navLink = "text-xs text-ink transition hover:text-brand-blue";

export function HeaderNav({ items, isLoggedIn }: { items: NavItem[]; isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  const authButton = isLoggedIn ? (
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
  );

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-7 sm:flex">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={navLink}>
            {item.label}
          </Link>
        ))}
        {authButton}
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/5 sm:hidden"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          {open ? "✕" : "☰"}
        </span>
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-12 border-b border-navy-900/10 bg-canvas/95 shadow-lg shadow-navy-900/10 backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm text-ink transition hover:bg-navy-900/5"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-navy-900/10 pt-3">{authButton}</div>
          </nav>
        </div>
      )}
    </>
  );
}
