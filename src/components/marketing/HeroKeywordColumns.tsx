"use client";

import { useEffect, useRef } from "react";
import { SAMPLE_KEYWORDS } from "@/lib/marketing-keywords";

/**
 * Kolom kata kunci di selokan kiri-kanan hero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA DI SELOKAN, DAN KENAPA HANYA DARI xl
 * ─────────────────────────────────────────────────────────────────────────
 * Isi pita dibatasi 980px (`max-w-band`) dan dirata-tengahkan, jadi di layar
 * lebar ada dua bidang navy kosong di kiri dan kanannya. Docblock hero sendiri
 * sudah menyebut bidang itu sebagai masalah — "bidang gelap luas yang kosong di
 * kiri-kanannya, yang justru membuat gradiennya terbaca rata". Kolom ini
 * mengisinya dengan hal yang kebetulan juga bukti produk: kata kunci yang
 * memang dihasilkan Nerona.
 *
 * Di bawah 1280px selokan itu habis. Bukan "sempit" — habis: pada 1024px lebar
 * isi sudah melebihi ruang yang tersedia, jadi kolomnya akan berdiri TEPAT di
 * belakang judul. Karena itu `hidden xl:block`, bukan sekadar diperkecil.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TIGA HAL YANG MEMBUATNYA HIASAN, BUKAN ISI
 * ─────────────────────────────────────────────────────────────────────────
 * `aria-hidden` (pembaca layar tidak perlu mengeja dua puluh empat kata kunci
 * sebelum sampai ke judul), `pointer-events-none` (teks yang tidak bisa
 * diseleksi tidak memancing orang mencoba mengkliknya), dan `select-none`.
 * Ketiganya wajib bersama: melewatkan satu saja membuat hiasan ini mulai
 * bersaing dengan ajakan yang jadi tujuan halaman.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PELURUHAN OPACITY
 * ─────────────────────────────────────────────────────────────────────────
 * Dua lapis, dan keduanya perlu. Warna dasarnya sudah lemah (`text-white/25`)
 * supaya baris teratas pun tidak pernah bersaing dengan eyebrow di sebelahnya,
 * lalu `mask-image` gradien vertikal membuatnya benar-benar meluruh jadi nol di
 * dasar pita. Hanya mengandalkan satu warna alfa rata akan memberi blok teks
 * yang berhenti mendadak di tepi bawah; hanya mengandalkan mask akan membuat
 * baris teratas terlalu keras.
 *
 * Propertinya ditulis di `style` dengan pasangan berawalan -webkit-, bukan
 * lewat utilitas arbitrer Tailwind. Safari masih menuntut `-webkit-mask-image`,
 * dan kelas arbitrer tidak menambahkan awalan itu sendiri — tanpa pasangannya
 * peluruhannya diam-diam tidak terjadi di sana, dan yang tersisa adalah blok
 * yang terpotong lurus.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PARALLAX
 * ─────────────────────────────────────────────────────────────────────────
 * Satu listener `scroll` pasif yang hanya menyetel `transform`, dikawal
 * requestAnimationFrame supaya tidak ada lebih dari satu penulisan per bingkai.
 * Tidak ada `top`, `margin`, atau apa pun yang memicu layout — kolom ini
 * membentang lebih tinggi dari viewport, dan menggerakkannya lewat properti
 * yang memaksa reflow akan terasa di setiap gulir.
 *
 * Kiri 0,30 dan kanan 0,18: kecepatannya sengaja BEDA. Dua kolom yang bergerak
 * seiring terbaca sebagai satu papan kaku yang digeser, bukan sebagai dua
 * lapisan pada kedalaman berbeda — dan kedalaman itulah satu-satunya alasan
 * efek ini ada.
 *
 * Kolomnya menjorok 240px ke atas DAN ke bawah pita. Tanpa itu, begitu halaman
 * digulir sedikit saja kolom yang bergerak turun akan meninggalkan pita kosong
 * di puncaknya. `overflow-hidden` pada pita yang memotong kelebihannya — dan
 * itulah satu-satunya sebab pita hero memintanya kembali.
 *
 * `prefers-reduced-motion` dihormati di JS, bukan cuma lewat `motion-reduce:`.
 * Aturan yang sama dipakai Reveal: kalau yang dimatikan hanya animasinya
 * sementara keadaan awalnya tetap dipasang, yang tersisa adalah elemen yang
 * tidak pernah sampai ke tempatnya.
 */

// Kolom kanan memakai daftar yang diputar, bukan dibalik. Dibalik membuat
// keduanya terbaca sebagai cermin — mata menangkap "sunset" berpasangan dengan
// "sunset" di seberangnya. Diputar dua belas langkah membuat setiap baris
// bersanding dengan kata yang berbeda.
const PUTARAN = 12;
const KIRI = [...SAMPLE_KEYWORDS, ...SAMPLE_KEYWORDS];
const KANAN = [...SAMPLE_KEYWORDS.slice(PUTARAN), ...SAMPLE_KEYWORDS.slice(0, PUTARAN)];
const KANAN_PENUH = [...KANAN, ...KANAN];

const PELURUHAN =
  "linear-gradient(to bottom, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / 0.7) 38%, rgb(0 0 0 / 0.25) 70%, rgb(0 0 0 / 0) 100%)";

export function HeroKeywordColumns() {
  const kiriRef = useRef<HTMLDivElement>(null);
  const kananRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const gulir = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        if (kiriRef.current) kiriRef.current.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
        if (kananRef.current) kananRef.current.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
      });
    };

    // Dipanggil sekali di awal: halaman yang dimuat ulang di tengah gulungan
    // (atau dibuka lewat tautan jangkar) sudah punya scrollY bukan nol sebelum
    // peristiwa gulir pertama datang.
    gulir();
    window.addEventListener("scroll", gulir, { passive: true });
    return () => {
      window.removeEventListener("scroll", gulir);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Lebarnya persis selokan yang tersedia: setengah dari sisa lebar pita
  // setelah dikurangi kolom isi. Dihitung di CSS, bukan di JS, supaya ia ikut
  // berubah saat jendela diubah ukurannya tanpa satu pun listener resize.
  // Garis bawahnya WAJIB: `calc` menuntut spasi di sekitar tanda kurang, dan
  // "100%-980px" tanpa spasi bukan ekspresi yang valid — ia gagal diam-diam dan
  // kolomnya jatuh ke lebar auto. Tailwind menerjemahkan garis bawah di nilai
  // arbitrer jadi spasi, jadi inilah cara menuliskan spasi itu.
  //
  // Tokennya `--band-w` (lebar isi pita), BUKAN `--band` (irama vertikal).
  // Keduanya sempat sama-sama bernama "band" dan versi pertama kolom ini
  // memang mengambil yang salah: hasilnya 916px alih-alih 470px pada layar
  // 1920 — cukup masuk akal untuk lolos dari mata, dan baru ketahuan setelah
  // lebarnya diukur langsung di peramban. Nilainya dibaca dari token, bukan
  // ditulis ulang sebagai 980px, supaya menggeser lebar pita ikut menggeser
  // selokannya.
  const selokan = "w-[calc((100%_-_var(--band-w))/2)]";
  const kolom =
    "absolute top-[-240px] bottom-[-240px] flex flex-col justify-start gap-4 text-caption leading-snug text-white/25";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden select-none xl:block"
    >
      <div
        ref={kiriRef}
        className={`${kolom} ${selokan} left-0 pl-6 pr-5`}
        style={{ maskImage: PELURUHAN, WebkitMaskImage: PELURUHAN }}
      >
        {KIRI.map((kata, i) => (
          <span key={`${kata}-${i}`}>{kata}</span>
        ))}
      </div>

      {/* Rata kanan supaya tepi ragged-nya menghadap keluar dan tepi rapinya
          menghadap kolom isi — dua tepi bergerigi yang mengapit judul membuat
          judulnya terlihat tidak lurus. */}
      <div
        ref={kananRef}
        className={`${kolom} ${selokan} right-0 items-end pl-5 pr-6 text-right`}
        style={{ maskImage: PELURUHAN, WebkitMaskImage: PELURUHAN }}
      >
        {KANAN_PENUH.map((kata, i) => (
          <span key={`${kata}-${i}`}>{kata}</span>
        ))}
      </div>
    </div>
  );
}
