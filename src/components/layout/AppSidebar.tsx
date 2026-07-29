"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, flatten, type NavSection } from "@/lib/nav";
import { Icon } from "@/components/ui/icons";

// `showLabels` is not computed from a window width — the collapsed strip and
// the labelled rail are two renders of this component, picked by Tailwind
// breakpoints on their containers in AppShell. That keeps the choice out of
// JavaScript, so there is no hydration mismatch and no flash of the wrong
// width on first paint.
export function AppSidebar({
  sections,
  showLabels,
  onNavigate,
}: {
  sections: NavSection[];
  showLabels?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname, flatten(sections));

  return (
    <nav className={`flex flex-col gap-4 py-4 ${showLabels ? "px-3" : "px-2"}`}>
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {section.title &&
            (showLabels ? (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                {section.title}
              </p>
            ) : (
              // "AKUN & TAGIHAN" cannot fit 56px, so the grouping survives as
              // a rule instead of a caption.
              <hr className="mx-2 mb-2 border-navy-900/10" />
            ))}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const isActive = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center rounded-lg transition ${
                      showLabels ? "gap-2.5 px-2 py-1.5" : "h-10 w-10 justify-center"
                    } ${
                      isActive
                        ? "bg-brand-blue/10 font-semibold text-ink"
                        : "text-muted hover:bg-navy-900/5 hover:text-ink"
                    }`}
                  >
                    <Icon name={item.icon} className="h-[18px] w-[18px] flex-none" />
                    {showLabels && <span className="truncate text-sm">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
