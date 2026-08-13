"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { activeHref, type NavItem } from "@/lib/nav";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/icons";

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
  //
  // Satu tombol berisi saja di bilah ini. "Coba Gratis" memakai variant
  // primary, yang di permukaan pemasaran keluar sebagai pil biru; pil emas
  // yang dulu berdiri di sini adalah warna uang, dan header tidak menjual
  // apa pun. "Masuk" turun jadi tautan teks supaya kedua aksi berhenti
  // terlihat sama penting.
  const authArea = dashboardHref ? (
    <ButtonLink href={dashboardHref} variant="secondary" size="sm">
      Dashboard →
    </ButtonLink>
  ) : (
    <>
      <Link href="/login" className="text-caption text-muted transition hover:text-ink">
        Masuk
      </Link>
      <ButtonLink href="/register" size="sm">
        Coba Gratis
      </ButtonLink>
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
              className={`text-caption transition ${
                isActive
                  ? "-mb-px border-b-2 border-accent pb-px font-semibold text-ink"
                  : "text-muted hover:text-ink"
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
        className="flex h-8 w-8 items-center justify-center rounded-control text-ink ring-1 ring-border transition hover:bg-surface-sunken sm:hidden"
      >
        <Icon name={open ? "close" : "menu"} className="h-4 w-4" />
      </button>

      {/* Mobile dropdown — satu-satunya lapisan di halaman publik yang memang
          melayang, jadi satu-satunya yang boleh berbayang (shadow-float). */}
      {open && (
        <div className="absolute left-0 right-0 top-14 border-b border-border bg-canvas/95 shadow-float backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex max-w-band flex-col gap-1 px-6 py-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={item.href === active ? "page" : undefined}
                className={`rounded-control px-2 py-2 text-body transition hover:bg-surface-sunken ${
                  item.href === active
                    ? "bg-surface-sunken font-semibold text-ink"
                    : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-divider pt-3">
              {authArea}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
