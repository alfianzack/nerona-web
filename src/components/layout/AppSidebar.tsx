"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, flatten, type NavSection } from "@/lib/nav";
import { Icon } from "@/components/ui/icons";

// Sidebar-nya SELALU navy sekarang — ketiga rendernya, tanpa kecuali — jadi
// warna di sini dibalik langsung, bukan lewat prop tema. Prop tema hanya masuk
// akal kalau ada pemanggil yang benar-benar butuh versi terang; tidak ada, dan
// menyediakannya berarti dua jalur warna yang harus dijaga bersamaan padahal
// satunya tidak pernah dirender.
//
// Yang dibalik dan kenapa: token `ink`, `muted`, `surface-sunken`, dan
// `divider` semuanya dikalibrasi untuk berdiri di atas canvas putih. Di atas
// navy-900 `muted` tinggal sekitar 1,9:1 dan `surface-sunken` praktis tidak
// bisa dibedakan dari latarnya, jadi keadaan aktif berhenti terbaca sama
// sekali. Penggantinya putih beralfa, bukan langkah navy yang lebih terang:
// alfa ikut bergerak sendiri kalau latarnya digeser nanti, sedangkan langkah
// tetap harus dipilih ulang dengan tangan.
//
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
              <p className="px-2 pb-1.5 font-mono text-label uppercase text-navy-100/60">
                {section.title}
              </p>
            ) : (
              // "AKUN & TAGIHAN" cannot fit 56px, so the grouping survives as
              // a rule instead of a caption.
              <hr className="mx-2 mb-2 border-white/10" />
            ))}
          {/* Keadaan aktif berhenti ditandai dengan latar biru merek tembus
              pandang. Di dalam aplikasi warna merek disimpan untuk hal yang
              bergerak, sedangkan "halaman yang sedang dibuka" adalah keadaan
              diam: permukaan cekung, teks ink tebal, dan satu batang aksen 2px
              di tepi kiri. Batangnya dipasang sebagai pseudo-elemen supaya
              butir yang tidak aktif tidak perlu ikut menyediakan ruang 2px —
              tanpa itu setiap perpindahan halaman menggeser seluruh daftar.

              Batangnya sekarang brand-sky, bukan accent. Sebabnya sama dengan
              sebab seluruh berkas ini dibalik: `accent` adalah biru yang
              dipilih untuk berdiri di atas putih, dan di atas navy-900 ia
              turun ke sekitar 1,5:1 — angka yang persis sama dengan yang
              membuat hero menolaknya. brand-sky adalah langkah terang yang
              sudah dipakai eyebrow hero di atas navy yang sama. */}
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
                    className={`relative flex items-center rounded-control transition ${
                      showLabels ? "gap-2.5 px-2 py-1.5" : "h-10 w-10 justify-center"
                    } ${
                      isActive
                        ? "bg-white/10 font-semibold text-white before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-sky"
                        : "text-navy-100 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon name={item.icon} className="h-[18px] w-[18px] flex-none" />
                    {showLabels && <span className="truncate text-body">{item.label}</span>}
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
