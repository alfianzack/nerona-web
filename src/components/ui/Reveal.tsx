"use client";

import { useEffect, useRef } from "react";
import { cn } from "./cn";

/**
 * Naik-memudar saat seksinya masuk layar. Sekali saja, tidak berulang.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA SERVER MERENDERNYA TERLIHAT PENUH
 * ─────────────────────────────────────────────────────────────────────────
 * Markup yang dikirim server TIDAK punya `opacity-0`. Penyembunyiannya
 * dipasang dari efek, jadi ia hanya terjadi kalau JavaScript benar-benar
 * berjalan. Pola sebaliknya — menyembunyikan di markup lalu memunculkannya
 * lewat JS — membuat seluruh isi halaman jualan ini HILANG bagi siapa pun yang
 * bundelnya gagal dimuat, dan itu kegagalan yang tidak terlihat di mesin
 * pengembang mana pun.
 *
 * Aturan yang sama sudah dipakai kartu hero: di sana keadaan `from` keyframe
 * yang menyembunyikan, bukan kelas di markup, supaya `motion-reduce` membuat
 * elemennya tampil utuh alih-alih hilang permanen.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * YANG SUDAH TERLIHAT SAAT MUAT TIDAK PERNAH DISEMBUNYIKAN
 * ─────────────────────────────────────────────────────────────────────────
 * `useEffect` berjalan SESUDAH cat pertama. Kalau elemen yang sudah tampak
 * ikut disembunyikan di sana, pembaca melihatnya sekejap lalu berkedip hilang
 * sebelum muncul lagi — persis kesan "halaman rusak" yang animasi ini
 * seharusnya hindari. Karena itu elemen yang sudah berada di dalam viewport
 * saat efek berjalan dibiarkan apa adanya, tanpa animasi sama sekali.
 *
 * Hero tidak memakai komponen ini: ia punya urutannya sendiri yang berjalan
 * saat muat.
 */
export function Reveal({
  children,
  /** Jeda mulai, untuk membuat elemen berurutan masuk bergantian. */
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Dihormati di sini, BUKAN cuma lewat `motion-reduce:` di CSS: kalau
    // penyembunyiannya tetap dipasang dan hanya animasinya yang dimatikan,
    // yang tersisa adalah elemen yang tidak pernah muncul.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Sudah terlihat saat muat → biarkan. Lihat docblock.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.reveal = "pending";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.reveal = "in";
          // Sekali saja. Elemen yang beranimasi ulang setiap kali digulir
          // melewatinya berhenti terasa seperti sambutan dan mulai terasa
          // seperti gangguan.
          observer.disconnect();
        }
      },
      // Dipicu sedikit SEBELUM benar-benar masuk layar, supaya gerakannya
      // selesai kira-kira saat pembaca sampai ke sana — bukan dimulai setelah
      // ia sudah menatapnya.
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
