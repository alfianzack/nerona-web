"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pageTitle, type NavSection } from "@/lib/nav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";

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
      className={`flex h-12 flex-none items-center text-sm font-semibold tracking-tight text-ink ${
        withWordmark ? "gap-2 px-5" : "justify-center"
      }`}
    >
      <img src="/logo-nerona.svg" alt="" className="h-5 w-5 flex-none" />
      {withWordmark && "Nerona"}
    </Link>
  );

  const pointsChip =
    points != null ? (
      <Link
        href="/finance"
        title="Saldo poin — lihat riwayat di Finance"
        className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-semibold text-[#9A6B08] ring-1 ring-gold-400/40 transition hover:bg-gold-400/30"
      >
        {points.toLocaleString("id-ID")} poin
      </Link>
    ) : null;

  const rail = "flex-none border-r border-navy-900/10 bg-surface/60";
  const railInner = "sticky top-0 flex h-screen flex-col";

  return (
    <div className="flex min-h-screen">
      {/* sm → xl: the 56px icon strip. w-14 is what keeps every lg: grid in the
          app working — a full 224px rail leaves a dashboard stat card 176px at
          1024px, and "Rp 4.250.000" at text-2xl needs about 165px in 136px of
          padded room. The strip gives 218px/178px instead. */}
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
          <div
            className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-navy-900/10 bg-canvas">
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
        <header className="sticky top-0 z-40 flex h-12 flex-none items-center justify-between gap-3 border-b border-navy-900/10 bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/5 sm:hidden"
            >
              <span className="text-lg leading-none" aria-hidden="true">
                ☰
              </span>
            </button>
            {/* A locator, not a heading — the page below owns the <h1>. */}
            <span className="truncate text-sm font-medium text-ink">{title}</span>
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
