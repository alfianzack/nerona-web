"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pageTitle, type NavSection } from "@/lib/nav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/icons";

export function AppShell({
  sections,
  points,
  email,
  homeHref,
  children,
}: {
  sections: NavSection[];
  points: number | null;
  email: string;
  homeHref: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const title = pageTitle(pathname, sections);

  // The wordmark only appears where there is room for it; the 56px strip gets
  // the logo mark alone, centered.
  const brand = (withWordmark: boolean) => (
    <Link
      href={homeHref}
      title="Nerona"
      className={`flex h-12 flex-none items-center text-body font-semibold text-ink ${
        withWordmark ? "gap-2 px-5" : "justify-center"
      }`}
    >
      <img src="/logo-nerona.svg" alt="" className="h-5 w-5 flex-none" />
      {withWordmark && "Nerona"}
    </Link>
  );

  // Emas bertahan di sini karena saldo poin adalah uang — satu-satunya tempat
  // emas muncul di luar tombol yang menggerakkan uang. Warnanya sekarang datang
  // dari nada `points` milik Badge, bukan dari hex lepas yang sebelumnya
  // ditulis tangan di sini.
  const pointsChip =
    points != null ? (
      <Link
        href="/finance"
        title="Saldo poin — lihat riwayat di Finance"
        className="inline-flex transition hover:opacity-80"
      >
        <Badge tone="points">{points.toLocaleString("id-ID")} poin</Badge>
      </Link>
    ) : null;

  const rail = "flex-none border-r border-border bg-surface";
  const railInner = "sticky top-0 flex h-screen flex-col";

  return (
    <div className="flex min-h-screen">
      {/* sm → xl: the 56px icon strip. w-14 is what keeps every lg: grid in the
          app working — a full 224px rail leaves a dashboard stat card 176px at
          1024px, and "Rp 4.250.000" at 24px needs about 165px in 136px of
          padded room. The strip gives 218px/178px instead. (Ukurannya sengaja
          ditulis sebagai angka: pemindai Tailwind ikut membaca komentar, jadi
          menyebut nama kelas di sini akan menghidupkannya di bundel CSS.) */}
      <aside className={`hidden w-14 sm:block xl:hidden ${rail}`}>
        <div className={railInner}>
          {brand(false)}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppSidebar sections={sections} />
          </div>
        </div>
      </aside>

      {/* xl and up: the full sidebar with labels and section headers. */}
      <aside className={`hidden w-56 xl:block ${rail}`}>
        <div className={railInner}>
          {brand(true)}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppSidebar sections={sections} showLabels />
          </div>
        </div>
      </aside>

      {/* Below sm: a drawer. An overlay has room, so it always shows labels. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Tirainya memakai ink, bukan navy: satu-satunya warna gelap yang
              masih dipegang token permukaan aplikasi. */}
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-border bg-canvas">
            {brand(true)}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AppSidebar
                sections={sections}
                showLabels
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 flex-none items-center justify-between gap-3 border-b border-border bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {/* Garis tiganya dulu glyph teks: tingginya berbeda di tiap sistem
                operasi dan ukurannya tidak bisa disetel. */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-control text-ink ring-1 ring-border transition hover:bg-surface-sunken sm:hidden"
            >
              <Icon name="menu" className="h-4 w-4" />
            </button>
            {/* A locator, not a heading — the page below owns the <h1>. */}
            <span className="truncate text-body font-medium text-ink">{title}</span>
          </div>
          <div className="flex flex-none items-center gap-2">
            {pointsChip}
            <AccountMenu email={email} />
          </div>
        </header>

        {/* Not <main> — every tenant page supplies its own. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
