"use client";

import Link from "next/link";
import { useState } from "react";
import { type NavSection } from "@/lib/nav";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/icons";

/**
 * Saldo poin dalam bentuk ringkas, untuk strip 56px.
 *
 * Ditulis tangan dan BUKAN `Intl.NumberFormat(..., { notation: "compact" })`,
 * meski itu terdengar seperti jawaban yang benar. Notasi ringkas Intl
 * bergantung pada data CLDR yang dibawa ICU, dan ICU di Node tidak selalu sama
 * versinya dengan ICU di peramban pembaca — id-ID bisa keluar "6,4 rb" di satu
 * sisi dan "6,4rb" di sisi lain. Angka ini dirender di server lalu dihidrasi di
 * klien, jadi selisih satu spasi saja sudah cukup untuk memicu peringatan
 * hydration mismatch pada setiap muat halaman.
 *
 * Di bawah 1.000 angkanya ditulis utuh: "999" tidak lebih panjang dari "1rb",
 * jadi tidak ada yang dihemat dengan meringkasnya.
 */
function poinRingkas(points: number): string {
  if (points < 1_000) return String(points);
  const [nilai, satuan] = points < 1_000_000 ? [points / 1_000, "rb"] : [points / 1_000_000, "jt"];
  // Satu angka di belakang koma, dan koma itu koma Indonesia. `toFixed` selalu
  // memberi titik, jadi penukarannya eksplisit — bukan diserahkan ke locale
  // yang justru baru saja ditolak di docblock.
  const teks = nilai >= 10 ? String(Math.round(nilai)) : nilai.toFixed(1).replace(".", ",");
  return `${teks}${satuan}`;
}

/**
 * Kerangka aplikasi: sidebar navy + isi halaman. Dipakai tenant DAN admin.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TIDAK ADA LAGI TOPBAR
 * ─────────────────────────────────────────────────────────────────────────
 * Bilah atas yang dulu membentang di sepanjang lebar isi sudah dibuang. Ia
 * memuat tiga hal, dan ketiganya sekarang punya tempat yang lebih baik:
 *
 * 1. Judul halaman. Ini duplikat, dan sudah duplikat sejak lama — setiap
 *    halaman aplikasi merender `PageHeader` dengan judul yang sama beberapa
 *    piksel di bawahnya. Komentar lama di sini bahkan menyebutnya "a locator,
 *    not a heading", yang adalah cara lain untuk mengatakan bahwa ia tidak
 *    mengerjakan apa pun yang belum dikerjakan `<h1>` di bawahnya.
 * 2. Saldo poin dan 3. menu akun. Keduanya naik ke PUNCAK SIDEBAR, tempat
 *    identitas memang dicari.
 *
 * Yang tersisa dari bilah itu hanya bar khusus ponsel di bawah `sm`. Itu bukan
 * inkonsistensi melainkan konsekuensi: di bawah `sm` sidebar-nya laci yang
 * tersembunyi, jadi "puncak sidebar" bukan tempat yang bisa dilihat siapa pun
 * tanpa mengetuk dulu. Barnya sengaja tidak membawa judul halaman — cuma
 * garis-tiga, poin, dan avatar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SIDEBAR NAVY
 * ─────────────────────────────────────────────────────────────────────────
 * Latarnya `navy-900`, yang nilainya persis #16233D — warna yang sama dengan
 * dasar pita hero di halaman publik. Ditulis sebagai token, bukan hex lepas,
 * justru supaya kesamaan itu tetap benar kalau nadanya digeser nanti.
 *
 * Konsekuensinya menyebar ke tiga berkas lain, dan masing-masing punya
 * docblock-nya sendiri: AppSidebar (butir nav), AccountMenu (avatar dan arah
 * panel), dan satu nada baru `points-navy` di Badge. Sebabnya satu dan sama —
 * token ink/muted/surface-sunken/accent semuanya dikalibrasi untuk berdiri di
 * atas canvas putih.
 *
 * Garis `border-r` ikut dilepas: bidang navy di atas canvas putih sudah jadi
 * batasnya sendiri, dan garis abu di antara keduanya justru terbaca sebagai
 * jahitan.
 */
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

  // The wordmark only appears where there is room for it; the 56px strip gets
  // the logo mark alone, centered.
  const brand = (withWordmark: boolean) => (
    <Link
      href={homeHref}
      title="Nerona"
      className={`flex h-12 flex-none items-center text-body font-semibold text-white ${
        withWordmark ? "gap-2 px-5" : "justify-center"
      }`}
    >
      <img src="/logo-nerona.svg" alt="" className="h-5 w-5 flex-none" />
      {withWordmark && "Nerona"}
    </Link>
  );

  // Emas bertahan di sini karena saldo poin adalah uang — satu-satunya tempat
  // emas muncul di luar tombol yang menggerakkan uang. Nadanya dipilih menurut
  // permukaan yang menopangnya: `points` di atas canvas putih bar ponsel,
  // `points-navy` di atas sidebar.
  const pointsChip = (tone: "points" | "points-navy") =>
    points != null ? (
      <Link
        href="/finance"
        title="Saldo poin — lihat riwayat di Finance"
        className="inline-flex transition hover:opacity-80"
      >
        <Badge tone={tone}>{points.toLocaleString("id-ID")} poin</Badge>
      </Link>
    ) : null;

  // Di strip 56px saldonya angka telanjang, bukan pil.
  //
  // Bukan karena pil kurang bagus, tapi karena tidak muat: strip menyisakan
  // 40px isi, sementara pil Badge sendiri sudah memakan 20px hanya untuk
  // padding kiri-kanan. Menimpanya lewat `className` juga bukan jalan keluar —
  // `cn` di proyek ini menggabung string apa adanya tanpa tailwind-merge, jadi
  // padding kecil versus padding pil diselesaikan oleh urutan kelas di CSS
  // keluaran, bukan oleh urutan penulisan. Angka telanjang menutup keduanya
  // sekaligus dan tidak menyalin definisi nada ke tempat kedua.
  const pointsCompact =
    points != null ? (
      <Link
        href="/finance"
        title={`${points.toLocaleString("id-ID")} poin — lihat riwayat di Finance`}
        className="font-mono text-label font-semibold tabular-nums text-gold-400 transition hover:opacity-80"
      >
        {poinRingkas(points)}
      </Link>
    ) : null;

  const rail = "flex-none bg-navy-900";
  const railInner = "sticky top-0 flex h-screen flex-col";

  // Identitas duduk di antara merek dan nav, dipisahkan garis dari keduanya.
  // Ia berada DI LUAR pembungkus `overflow-y-auto` milik nav dengan sengaja:
  // panel menu akun melayang keluar dari kotaknya, dan di dalam wadah yang
  // menggulir ia akan terpotong.
  const identity = (withLabels: boolean) =>
    withLabels ? (
      <div className="flex-none px-3 pb-3">
        <AccountMenu email={email} variant="row" />
        {points != null && <div className="mt-1.5 px-2">{pointsChip("points-navy")}</div>}
      </div>
    ) : (
      <div className="flex flex-none flex-col items-center gap-1 pb-3">
        <AccountMenu email={email} variant="rail" />
        {pointsCompact}
      </div>
    );

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
          {identity(false)}
          <hr className="mx-2 flex-none border-white/10" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppSidebar sections={sections} />
          </div>
        </div>
      </aside>

      {/* xl and up: the full sidebar with labels and section headers. */}
      <aside className={`hidden w-56 xl:block ${rail}`}>
        <div className={railInner}>
          {brand(true)}
          {identity(true)}
          <hr className="mx-3 flex-none border-white/10" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppSidebar sections={sections} showLabels />
          </div>
        </div>
      </aside>

      {/* Below sm: a drawer. An overlay has room, so it always shows labels. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Tirainya memakai ink, bukan navy: satu-satunya warna gelap yang
              masih dipegang token permukaan aplikasi. Sekarang lacinya sendiri
              navy, dan justru itu sebab tirainya TIDAK ikut navy — dua navy
              berlapis membuat tepi laci hilang. */}
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-navy-900">
            {brand(true)}
            {identity(true)}
            <hr className="mx-3 flex-none border-white/10" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AppSidebar sections={sections} showLabels onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sisa terakhir bilah atas, dan hanya di bawah `sm`. Lihat docblock. */}
        <header className="sticky top-0 z-40 flex h-12 flex-none items-center justify-between gap-3 border-b border-border bg-canvas/80 px-4 backdrop-blur-xl sm:hidden">
          {/* Garis tiganya dulu glyph teks: tingginya berbeda di tiap sistem
              operasi dan ukurannya tidak bisa disetel. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-control text-ink ring-1 ring-border transition hover:bg-surface-sunken"
          >
            <Icon name="menu" className="h-4 w-4" />
          </button>
          <div className="flex flex-none items-center gap-2">
            {pointsChip("points")}
            <AccountMenu email={email} />
          </div>
        </header>

        {/* Not <main> — every tenant page supplies its own. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
