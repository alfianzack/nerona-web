"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";

export type NavItem = { href: string; label: string };

const navLink = "text-xs transition hover:text-brand-blue";

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

export function HeaderNav({ items, isLoggedIn }: { items: NavItem[]; isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname, items);

  function handleSignOut() {
    setSigningOut(true);
    signOut({ callbackUrl: "/" });
  }

  const authButton = isLoggedIn ? (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        setConfirmOpen(true);
      }}
      className="rounded-full bg-navy-900/5 px-3.5 py-1.5 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
    >
      Sign Out
    </button>
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
        {items.map((item) => {
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`${navLink} ${
                isActive
                  ? "-mb-px border-b-2 border-brand-blue pb-px font-semibold text-ink"
                  : "text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
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
            {items.map((item) => {
              const isActive = item.href === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-lg px-2 py-2 text-sm transition hover:bg-navy-900/5 ${
                    isActive ? "bg-navy-900/5 font-semibold text-ink" : "text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-navy-900/10 pt-3">{authButton}</div>
          </nav>
        </div>
      )}

      {/* Sign-out confirmation */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Keluar dari akun?">
        <p className="text-sm leading-relaxed text-muted">
          Anda akan keluar dari akun Nerona di perangkat ini. Anda bisa masuk kembali kapan saja.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            disabled={signingOut}
            className="rounded-full bg-navy-900/5 px-4 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
          >
            {signingOut ? "Keluar..." : "Ya, keluar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
