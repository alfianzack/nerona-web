"use client";

import { useEffect, useRef } from "react";
import type Matter from "matter-js";
import { SAMPLE_KEYWORDS } from "@/lib/marketing-keywords";

/**
 * Hujan kata kunci di selokan kiri-kanan hero.
 *
 * Menggantikan kolom statis-berparallax sebelumnya. Kata kunci lahir di atas
 * pita, jatuh dengan gravitasi sungguhan sambil berputar pelan, lalu MENUMPUK
 * di dasar pita — tepat di garis ke rak putih di bawahnya. Sentuhan pertama ke
 * lantai atau ke tumpukan memberinya satu warna dari palet merek. Cincin yang
 * mengikuti kursor adalah benda fisik: kata yang jatuh terpental darinya dan
 * tumpukan bisa didorong.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KENAPA MESIN FISIKA, DAN KENAPA DIMUAT LAZY
 * ─────────────────────────────────────────────────────────────────────────
 * "Menumpuk" hanya terlihat benar dengan tabrakan sungguhan; fisika palsu
 * (jatuh + tumpuk per jalur) memberi tumpukan kaku seperti balok. Matter.js
 * ±25 KB gzip, dan itu terlalu mahal untuk dibayar pembaca yang tidak pernah
 * melihatnya — di bawah `xl` selokannya nol dan efek ini tidak dirender sama
 * sekali. Karena itu `import()` dinamis yang baru dipanggil SETELAH lebar dan
 * preferensi gerak diperiksa: pembaca ponsel tidak mengunduh sebyte pun.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUNIA FISIKANYA
 * ─────────────────────────────────────────────────────────────────────────
 * Satu engine untuk seluruh pita, dengan satu balok statis selebar `--band-w`
 * di tengah: kata tidak pernah bisa masuk ke kolom judul, apa pun yang
 * dilakukan kursor. Lantai tepat di tepi bawah pita. Kata lahir DI ATAS pita
 * dan terpotong `overflow-hidden` pita, jadi ia tampak turun dari langit,
 * bukan muncul mendadak.
 *
 * Teks tidak pernah terbalik. Body-nya persegi panjang yang simetris pada
 * putaran 180°, jadi sudut GAMBAR-nya boleh dilipat ke (−90°, 90°] tanpa
 * menyentuh fisikanya sedikit pun. Tanpa lipatan ini separuh tumpukan mendarat
 * kepala di bawah dan berhenti terbaca — terbukti di mockup.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TIGA REM SUPAYA IA TETAP HIASAN
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Tumpukan dibatasi per sisi; lewat batas, yang paling lama mendarat memudar
 *    lalu dibuang. Hujan tak pernah berhenti, tumpukan tak pernah menutupi hero.
 * 2. Simulasi berhenti total saat pita keluar layar (IntersectionObserver) dan
 *    saat tab tidur. Kembali dari tidur TIDAK memuntahkan kata yang "terutang"
 *    — jam lahirnya disetel ulang, bukan dikejar.
 * 3. `prefers-reduced-motion` → tidak ada yang dirender dan tidak ada yang
 *    diunduh. Aturan yang sama dipakai Reveal dan kolom sebelumnya.
 *
 * Kursor asli TIDAK disembunyikan. Mockup menyembunyikannya dan menaruh titik
 * di pusat cincin; di halaman sungguhan ada tombol dan tautan di tengah pita,
 * dan kursor yang hilang di atas tombol adalah cacat aksesibilitas, bukan gaya.
 * Cincinnya mengelilingi kursor asli.
 */

// Angka-angka ini yang disetujui owner lewat panel mockup, bukan tebakan.
const KATA_PER_DETIK_PER_SISI = 0.9;
const GRAVITASI = 0.55;
const PUTARAN_MAKS = 0.035;
const TUMPUKAN_MAKS_PER_SISI = 45;
const JARI_CINCIN = 70;
const LEBAR_MIN = 1280; // = breakpoint `xl`; di bawahnya selokan hero nol

// Warna saat mendarat: kelas Tailwind yang ditulis utuh supaya pemindainya
// melihatnya. `text-action` di seksi terang adalah amber (lihat globals.css).
const PALET = ["text-brand-sky", "text-action", "text-brand-gold", "text-navy-100", "text-white"];
const JATUH = "text-white/25";

type Kata = {
  body: Matter.Body;
  el: HTMLSpanElement;
  w: number;
  h: number;
  sisi: 0 | 1;
  mendarat: boolean;
  t: number;
  pudar: boolean;
};

const acak = (a: number, b: number) => a + Math.random() * (b - a);

export function HeroKeywordRain() {
  const lapisanRef = useRef<HTMLDivElement>(null);
  const cincinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lapisan = lapisanRef.current;
    const cincin = cincinRef.current;
    const pita = lapisan?.closest("section");
    if (!lapisan || !cincin || !pita) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let M: typeof Matter | null = null;
    let engine: Matter.Engine | null = null;
    let kursor: Matter.Body | null = null;
    let kata: Kata[] = [];
    let W = 0;
    let H = 0;
    let selokan = 0;
    let hidup = false;
    let terlihat = true;
    let tLahir = 0;
    let urutan = 0;
    let rafId = 0;
    let dibongkar = false;
    const timer = new Set<ReturnType<typeof setTimeout>>();

    // Pengukur: span sungguhan dengan kelas yang sama, supaya body fisiknya
    // seukuran hurufnya — bukan tebakan lebar per karakter.
    const pengukur = document.createElement("span");
    pengukur.className = kelasKata(JATUH);
    pengukur.style.visibility = "hidden";
    lapisan.appendChild(pengukur);
    const ukur = (teks: string) => {
      pengukur.textContent = teks;
      return { w: pengukur.offsetWidth, h: pengukur.offsetHeight };
    };

    function kelasKata(warna: string) {
      return `absolute left-0 top-0 whitespace-nowrap px-2 py-[5px] text-caption font-medium leading-none transition-[color,opacity] duration-300 will-change-transform ${warna}`;
    }

    async function bangun() {
      bongkar();
      const r = pita!.getBoundingClientRect();
      W = r.width;
      H = r.height;
      if (W < LEBAR_MIN) return;
      if (!M) {
        const mod = await import("matter-js");
        M = ((mod as unknown as { default?: typeof Matter }).default ?? mod) as typeof Matter;
        if (dibongkar) return;
      }
      const bandW = parseFloat(getComputedStyle(pita!).getPropertyValue("--band-w")) || 980;
      selokan = (W - bandW) / 2;

      const { Engine, World, Bodies, Events } = M;
      engine = Engine.create({ gravity: { x: 0, y: GRAVITASI } });
      engine.positionIterations = 8;
      engine.velocityIterations = 6;
      const tebal = 60;
      const statis = { isStatic: true, friction: 0.6, restitution: 0.05 };
      World.add(engine.world, [
        // Lantai = tepi bawah pita, garis ke rak putih.
        Bodies.rectangle(W / 2, H + tebal / 2, W + 200, tebal, statis),
        Bodies.rectangle(-tebal / 2, H / 2, tebal, H * 4, statis),
        Bodies.rectangle(W + tebal / 2, H / 2, tebal, H * 4, statis),
        // Kolom isi: kata tidak boleh masuk, apa pun yang dilakukan kursor.
        Bodies.rectangle(W / 2, H / 2, bandW, H * 4, statis),
      ]);
      kursor = Bodies.circle(-1000, -1000, JARI_CINCIN, { isStatic: true, restitution: 0.2, friction: 0.1 });
      World.add(engine.world, kursor);

      Events.on(engine, "collisionStart", (e) => {
        for (const p of e.pairs) {
          // Terpental dari cincin bukan "mendarat".
          if (p.bodyA === kursor || p.bodyB === kursor) continue;
          for (const b of [p.bodyA, p.bodyB]) {
            const k = (b.plugin as { kata?: Kata }).kata;
            if (k && !k.mendarat) mendarat(k);
          }
        }
      });
      hidup = true;
      tLahir = performance.now();
    }

    function bongkar() {
      hidup = false;
      if (engine && M) {
        M.World.clear(engine.world, false);
        M.Engine.clear(engine);
      }
      engine = null;
      kursor = null;
      for (const k of kata) k.el.remove();
      kata = [];
      for (const t of timer) clearTimeout(t);
      timer.clear();
    }

    function lahir(sisi: 0 | 1) {
      if (!engine || !M) return;
      const teks = SAMPLE_KEYWORDS[urutan++ % SAMPLE_KEYWORDS.length];
      const { w, h } = ukur(teks);
      const margin = 24 + w / 2;
      const x = sisi === 0 ? acak(margin, selokan - margin) : acak(W - selokan + margin, W - margin);
      const body = M.Bodies.rectangle(x, -h - acak(0, 60), w, h, {
        chamfer: { radius: 4 },
        friction: 0.5,
        frictionAir: 0.012,
        restitution: 0.08,
        density: 0.0012,
        angle: acak(-0.35, 0.35),
      });
      M.Body.setAngularVelocity(body, acak(-PUTARAN_MAKS, PUTARAN_MAKS));
      const el = document.createElement("span");
      el.className = kelasKata(JATUH);
      el.textContent = teks;
      lapisan!.appendChild(el);
      const k: Kata = { body, el, w, h, sisi, mendarat: false, t: 0, pudar: false };
      body.plugin = { kata: k };
      kata.push(k);
      M.World.add(engine.world, body);
      batasi(sisi);
    }

    function mendarat(k: Kata) {
      k.mendarat = true;
      k.t = performance.now();
      k.el.className = kelasKata(PALET[Math.floor(Math.random() * PALET.length)]).replace(
        "font-medium",
        "font-semibold",
      );
    }

    // Tumpukan dibatasi: yang paling lama mendarat memudar lalu dibuang.
    function batasi(sisi: 0 | 1) {
      let lebih = kata.filter((k) => k.sisi === sisi).length - TUMPUKAN_MAKS_PER_SISI;
      if (lebih <= 0) return;
      const tumpuk = kata.filter((k) => k.sisi === sisi && k.mendarat && !k.pudar).sort((a, b) => a.t - b.t);
      for (const k of tumpuk) {
        if (lebih-- <= 0) break;
        k.pudar = true;
        k.el.style.opacity = "0";
        const t = setTimeout(() => {
          timer.delete(t);
          buang(k);
        }, 440);
        timer.add(t);
      }
    }

    function buang(k: Kata) {
      if (engine && M) M.World.remove(engine.world, k.body);
      k.el.remove();
      kata = kata.filter((x) => x !== k);
    }

    // Kursor: cincin mengikuti mouse dan menjadi benda fisik.
    const gerak = (e: MouseEvent) => {
      const r = pita!.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      cincin.style.transform = `translate3d(${x - JARI_CINCIN}px, ${y - JARI_CINCIN}px, 0)`;
      cincin.style.opacity = "1";
      if (kursor && M) M.Body.setPosition(kursor, { x, y });
    };
    const keluar = () => {
      cincin.style.opacity = "0";
      if (kursor && M) M.Body.setPosition(kursor, { x: -1000, y: -1000 });
    };
    pita.addEventListener("mousemove", gerak);
    pita.addEventListener("mouseleave", keluar);

    const interval = 1000 / KATA_PER_DETIK_PER_SISI;
    function tick(now: number) {
      rafId = requestAnimationFrame(tick);
      if (!hidup || !terlihat || document.hidden || !engine || !M) return;
      // Kembali dari tidur: setel ulang jamnya, jangan kejar kata yang terutang.
      if (now - tLahir > interval * 4) tLahir = now;
      while (now - tLahir > interval) {
        lahir(0);
        lahir(1);
        tLahir += interval;
      }
      M.Engine.update(engine, 1000 / 60);
      for (const k of kata) {
        const { x, y } = k.body.position;
        // Lipat sudut gambar ke (−90°, 90°] — lihat docblock.
        let a = k.body.angle % Math.PI;
        if (a > Math.PI / 2) a -= Math.PI;
        else if (a <= -Math.PI / 2) a += Math.PI;
        k.el.style.transform = `translate3d(${(x - k.w / 2).toFixed(1)}px, ${(y - k.h / 2).toFixed(1)}px, 0) rotate(${a.toFixed(3)}rad)`;
        // Pengaman: apa pun yang lolos dari lantai dibuang.
        if (y > H + 120 && !k.pudar) buang(k);
      }
    }
    rafId = requestAnimationFrame(tick);

    const io = new IntersectionObserver(([e]) => {
      terlihat = e.isIntersecting;
    });
    io.observe(pita);

    let tunda: ReturnType<typeof setTimeout> | undefined;
    const ukurUlang = () => {
      clearTimeout(tunda);
      tunda = setTimeout(() => void bangun(), 300);
    };
    window.addEventListener("resize", ukurUlang);

    // Mulai setelah font siap, supaya ukuran body = ukuran huruf yang benar.
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      if (!dibongkar) void bangun();
    });

    return () => {
      dibongkar = true;
      cancelAnimationFrame(rafId);
      clearTimeout(tunda);
      io.disconnect();
      window.removeEventListener("resize", ukurUlang);
      pita.removeEventListener("mousemove", gerak);
      pita.removeEventListener("mouseleave", keluar);
      bongkar();
      pengukur.remove();
    };
  }, []);

  return (
    <>
      {/* Lapisan kata. `aria-hidden` + `pointer-events-none` + `select-none`:
          ketiganya wajib bersama supaya hiasan ini tidak pernah bersaing dengan
          ajakan di tengah pita. Mask di puncak melembutkan kelahiran kata. */}
      <div
        ref={lapisanRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden select-none xl:block"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0, #000 72px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 72px)",
        }}
      />
      {/* Cincin kursor: mengelilingi kursor asli, tidak menggantikannya.
          Garisnya `border`, BUKAN `ring`: utilitas ring Tailwind dibuat dari
          box-shadow, dan cahaya di `style` di bawah juga box-shadow — yang
          inline menang, dan garis cincinnya hilang diam-diam. Terlihat di
          potret pertama: yang tersisa hanya kabut samar tanpa tepi. */}
      <div
        ref={cincinRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 hidden h-[140px] w-[140px] rounded-full border border-brand-sky/70 opacity-0 transition-opacity duration-200 will-change-transform xl:block"
        style={{
          boxShadow: "inset 0 0 40px rgb(110 201 242 / 0.18), 0 0 30px rgb(110 201 242 / 0.12)",
        }}
      />
    </>
  );
}
