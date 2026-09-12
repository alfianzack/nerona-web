"use client";

import { useEffect, useRef } from "react";
import { SAMPLE_KEYWORDS } from "@/lib/marketing-keywords";
import {
  RUANG,
  alfaGaris,
  alfaKata,
  faktorMuat,
  gulirKeKedalaman,
  jarakKeKotak,
  jarakTempuh,
  keadaanLapisan,
  kedalamanKeGulir,
  lipatKedalaman,
  proyeksi,
  type Kotak,
} from "@/lib/ruang";

/**
 * Ruang Kata: beranda sebagai ruang kedalaman.
 *
 * Gulir tidak menggeser halaman ke bawah, melainkan mendorong kamera MAJU.
 * Setiap `Lapisan` hidup di kedalamannya sendiri: mendekat dari kabur, tajam
 * saat difokus, lalu ditembus menuju lapisan berikut. Di sekelilingnya ±400
 * kata kunci contoh melayang, berkelip, dan saling terhubung garis tipis —
 * satu ruang yang sama dari lapisan pertama sampai terakhir.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PANGGUNG STICKY, BUKAN FIXED
 * ─────────────────────────────────────────────────────────────────────────
 * Wadahnya setinggi 100vh + jarak tempuh, dan panggungnya `position: sticky`
 * di bawah header. Fixed akan menutup header layout dan membuat Footer asli
 * tak terjangkau; sticky membiarkan keduanya di alirannya: header tetap di
 * atas, dan begitu wadah habis, Footer muncul di bawah tanpa hack.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PENINGKATAN BERTAHAP — TANPA JS HALAMAN TETAP UTUH
 * ─────────────────────────────────────────────────────────────────────────
 * Markup yang dikirim server adalah lima seksi BERTUMPUK biasa di atas navy.
 * Mesin baru dinyalakan dari efek, dan hanya di ≥ lg tanpa
 * prefers-reduced-motion. Aturan yang sama dengan Reveal: penyembunyian
 * dipasang oleh JS, bukan di markup, supaya bundel yang gagal dimuat, layar
 * sempit, dan pembaca yang meminta gerak dikurangi semuanya mendapat halaman
 * yang bisa dibaca, bukan panggung kosong.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AKSESIBILITAS YANG MOCKUP BELUM PUNYA
 * ─────────────────────────────────────────────────────────────────────────
 * Semua lapisan tetap di DOM. `focusin` ke elemen di lapisan yang tidak sedang
 * difokus memicu selam ke lapisan itu, jadi Tab tidak pernah terjebak di
 * lapisan yang tak terlihat. Anchor `#pricing`/`#faq` dicegat dan diterjemahkan
 * jadi selam (lompatan asli browser akan mendarat di dalam panggung sticky, di
 * kedalaman yang salah). Rel kedalaman adalah tombol berlabel sungguhan.
 *
 * Matematikanya di lib/ruang.ts, murni dan diuji; berkas ini hanya DOM,
 * kanvas, dan peristiwa.
 */

type Rel = { z: number; nama: string; id?: string };

type Kata = {
  teks: string;
  sisi: 1 | -1;
  x: number;
  y: number;
  z: number;
  fase: number;
  laju: number;
  kedip: boolean;
  emas: boolean;
};

const PER_SISI = 200;
const acak = (a: number, b: number) => a + Math.random() * (b - a);

// Posisi acak, tapi SISI-nya tetap: kata genap selalu lahir di kiri, ganjil di
// kanan. Diundi bebas, dadu pernah memberi sisi kanan 30% lebih sedikit.
// Koridor tengah dikosongkan supaya kata tidak menabrak judul saat lewat dekat.
function posisi(k: Kata): Kata {
  let x = acak(0.1, RUANG.SPREAD);
  const y = acak(-1.6, 1.6);
  if (x < 0.6 && Math.abs(y) < 0.6) x += 0.7;
  k.x = k.sisi * x;
  k.y = y;
  return k;
}

function lahirkanKata(): Kata[] {
  const panjang = RUANG.FAR - RUANG.NEAR;
  return Array.from({ length: PER_SISI * 2 }, (_, i) => {
    const j = i >> 1;
    return posisi({
      teks: SAMPLE_KEYWORDS[i % SAMPLE_KEYWORDS.length],
      sisi: i % 2 ? 1 : -1,
      x: 0,
      y: 0,
      // Kedalaman, kedip, dan emas dijatah berpasangan per sisi, bukan diundi:
      // kedua sisi identik secara statistik.
      z: RUANG.NEAR + 0.2 + ((j + Math.random()) / PER_SISI) * (panjang - 0.2),
      fase: acak(0, Math.PI * 2),
      laju: acak(0.7, 1.9),
      kedip: j % 3 === 0,
      emas: j % 17 === 0,
    });
  });
}

export function RuangKata({ lapisan, children }: { lapisan: Rel[]; children: React.ReactNode }) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const kanvasRef = useRef<HTMLCanvasElement>(null);
  const selamRef = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    const wadah = wadahRef.current;
    const kanvas = kanvasRef.current;
    if (!wadah || !kanvas) return;
    const panggung = kanvas.parentElement as HTMLElement;
    const elLapisan = Array.from(panggung.querySelectorAll<HTMLElement>(".ruang-lapisan"));
    const Z = elLapisan.map((el) => Number(el.dataset.z));
    const tempuh = jarakTempuh(Z);
    const ctx = kanvas.getContext("2d");
    if (!ctx || elLapisan.length === 0) return;

    const tombolRel = Array.from(wadah.querySelectorAll<HTMLButtonElement>(".ruang-rel button"));
    const bolehHidup = () =>
      window.matchMedia("(min-width: 1024px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let hidup = false;
    let rafId = 0;
    let cam = 0;
    let target = 0;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let wadahAtas = 0;
    let fontKata = "Inter, system-ui, sans-serif";
    let kotakInfo: Kotak[] = [];
    let muat: number[] = elLapisan.map(() => 1);
    const kata = lahirkanKata();
    const t0 = performance.now();

    // ── Ukuran ──────────────────────────────────────────────────────────
    function ukur() {
      const header = document.querySelector("header");
      const atas = header ? Math.round(header.getBoundingClientRect().height) : 0;
      wadah!.style.setProperty("--ruang-atas", `${atas}px`);
      wadah!.style.height = `calc(100vh + ${tempuh * RUANG.PX_PER_UNIT}px)`;
      const r = panggung.getBoundingClientRect();
      W = r.width;
      H = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      kanvas!.width = Math.round(W * dpr);
      kanvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      wadahAtas = wadah!.getBoundingClientRect().top + window.scrollY;
      // Faktor muat dibaca dari tinggi tata letak (tidak terpengaruh transform).
      muat = elLapisan.map((el) => faktorMuat(el.offsetHeight, H));
      fontKata = getComputedStyle(document.body).fontFamily || fontKata;
      bacaGulir();
    }

    function bacaGulir() {
      target = gulirKeKedalaman(window.scrollY - wadahAtas, tempuh);
    }

    // ── Selam ke lapisan ────────────────────────────────────────────────
    function selamKe(i: number, halus = true) {
      if (i < 0 || i >= Z.length) return;
      const top = wadahAtas + kedalamanKeGulir(Z[i]);
      if (!hidup) {
        elLapisan[i].scrollIntoView({ behavior: halus ? "smooth" : "auto", block: "start" });
        return;
      }
      window.scrollTo({ top, behavior: halus ? "smooth" : "auto" });
    }
    selamRef.current = (i) => selamKe(i);

    const indeksDariHash = (hash: string) => {
      const id = hash.replace(/^#/, "");
      if (!id) return -1;
      return elLapisan.findIndex((el) => (el.dataset.anchor ?? el.id) === id);
    };

    // Selama hidup, `id` lapisan dipindah ke data-anchor. Chrome mengulang
    // lompatan fragmen bawaannya sesudah load; elemen yang absolut di dalam
    // panggung sticky tidak pernah bisa "sampai ke atas", jadi ia menggulir ke
    // dasar halaman dan menimpa selam kita — terlihat saat membuka /#faq
    // langsung: yang difokus lapisan terakhir. Tanpa id, lompatan itu tidak
    // menemukan target. Mode bertumpuk mendapat id-nya kembali.
    function sembunyikanAnchor() {
      for (const el of elLapisan) if (el.id) { el.dataset.anchor = el.id; el.removeAttribute("id"); }
    }
    function pulihkanAnchor() {
      for (const el of elLapisan) if (el.dataset.anchor) { el.id = el.dataset.anchor; delete el.dataset.anchor; }
    }

    // Anchor di halaman ini (#pricing, #faq, dari nav maupun tombol hero)
    // dicegat: lompatan asli browser mendarat di dalam panggung sticky pada
    // kedalaman yang salah.
    function klikAnchor(e: MouseEvent) {
      if (!hidup || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!a) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const i = indeksDariHash(url.hash);
      if (i < 0) return;
      e.preventDefault();
      history.pushState(null, "", url.hash);
      selamKe(i);
    }
    function hashBerubah() {
      const i = indeksDariHash(location.hash);
      if (i >= 0) selamKe(i);
    }

    // Tab ke lapisan yang tidak difokus → selam ke sana.
    function fokusMasuk(e: FocusEvent) {
      if (!hidup) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".ruang-lapisan");
      if (!el || el.classList.contains("ruang-fokus")) return;
      selamKe(elLapisan.indexOf(el));
    }

    // ── Kanvas: kata & garis rasi ───────────────────────────────────────
    const titik: { sx: number; sy: number; a: number; p: number }[] = [];
    const skalaLayar = () => Math.min(W, H) * 0.5;

    function gambarKata(t: number) {
      ctx!.clearRect(0, 0, W, H);
      ctx!.textBaseline = "middle";
      titik.length = 0;
      const skala = skalaLayar();
      for (const k of kata) {
        const lipat = lipatKedalaman(k.z, cam);
        if (lipat.dilipat) {
          k.z = lipat.z;
          posisi(k); // undi ulang x/y supaya putaran berikutnya tidak berpola sama
        }
        const dz = k.z - cam;
        const p = proyeksi(dz);
        const sx = W / 2 + k.x * skala * p;
        const sy = H / 2 + k.y * skala * p;
        const ukuran = 13 * p;
        if (ukuran < 3 || ukuran > 160) continue; // < 3px terbaca sebagai titik bintang, dan itu yang diinginkan
        let a = alfaKata(dz);
        // Area informasi bersih dari kata: nol di dalam kotak, penuh 90px di luarnya.
        a *= Math.min(1, jarakKeKotak(sx, sy, kotakInfo) / 90);
        const gel = Math.sin(t * k.laju + k.fase);
        a *= k.kedip ? Math.max(0, gel) : 0.6 + 0.4 * gel;
        if (a <= 0.01) continue;
        titik.push({ sx, sy, a, p });
        ctx!.globalAlpha = a;
        ctx!.fillStyle = k.emas ? "#FFD65C" : p > 1.2 ? "#FFFFFF" : "#C7CDEB";
        ctx!.font = `${p > 1.1 ? 600 : 500} ${ukuran.toFixed(1)}px ${fontKata}`;
        ctx!.fillText(k.teks, sx - ctx!.measureText(k.teks).width / 2, sy);
      }
      ctx!.globalAlpha = 1;
      gambarGaris();
    }

    function gambarGaris() {
      const jangkau = 240 * (Math.min(W, H) / 900);
      ctx!.lineWidth = dpr > 1 ? 0.75 : 1;
      ctx!.lineCap = "round";
      for (let i = 0; i < titik.length; i++) {
        const A = titik[i];
        for (let j = i + 1; j < titik.length; j++) {
          const B = titik[j];
          const dx = A.sx - B.sx;
          const dy = A.sy - B.sy;
          if (Math.abs(dx) > jangkau || Math.abs(dy) > jangkau) continue;
          const a = alfaGaris(Math.hypot(dx, dy), jangkau, A.a, B.a, A.p, B.p);
          if (a <= 0) continue;
          // Garis tidak boleh melintasi area informasi: titik tengahnya dicek.
          if (jarakKeKotak((A.sx + B.sx) / 2, (A.sy + B.sy) / 2, kotakInfo) < 40) continue;
          ctx!.strokeStyle = `rgba(110,201,242,${a.toFixed(3)})`;
          ctx!.beginPath();
          ctx!.moveTo(A.sx, A.sy);
          ctx!.lineTo(B.sx, B.sy);
          ctx!.stroke();
        }
      }
    }

    // ── Lapisan DOM ─────────────────────────────────────────────────────
    let aktifSebelumnya = -1;
    function aturLapisan() {
      const pr = panggung.getBoundingClientRect();
      const kotakBaru: Kotak[] = [];
      let aktif = 0;
      let terbaik = Infinity;
      elLapisan.forEach((el, i) => {
        const k = keadaanLapisan(Z[i] - cam, muat[i]);
        if (!k.tampak) {
          el.style.opacity = "0";
          el.classList.remove("ruang-fokus");
          return;
        }
        el.style.transform = `translate(-50%, -50%) scale(${k.skala.toFixed(4)})`;
        el.style.opacity = k.alfa.toFixed(3);
        el.style.filter = k.kabur ? `blur(${k.kabur.toFixed(1)}px)` : "none";
        el.classList.toggle("ruang-fokus", k.fokus);
        if (k.alfa > 0.05) {
          const r = (el.firstElementChild as HTMLElement).getBoundingClientRect();
          kotakBaru.push({
            left: r.left - pr.left - 16,
            right: r.right - pr.left + 16,
            top: r.top - pr.top - 12,
            bottom: r.bottom - pr.top + 12,
          });
        }
        if (k.jarakFokus < terbaik) {
          terbaik = k.jarakFokus;
          aktif = i;
        }
      });
      kotakInfo = kotakBaru;
      if (aktif !== aktifSebelumnya) {
        aktifSebelumnya = aktif;
        tombolRel.forEach((b, i) => {
          b.classList.toggle("ruang-rel-aktif", i === aktif);
          if (i === aktif) b.setAttribute("aria-current", "true");
          else b.removeAttribute("aria-current");
        });
      }
      wadah!.classList.toggle("ruang-dalam", cam > 0.15);
    }

    function bingkai(now: number) {
      rafId = requestAnimationFrame(bingkai);
      if (document.hidden) return;
      cam += (target - cam) * RUANG.PELUNAKAN;
      gambarKata((now - t0) / 1000);
      aturLapisan();
    }

    // ── Hidup / mati ────────────────────────────────────────────────────
    function nyalakan() {
      if (hidup) return;
      hidup = true;
      wadah!.classList.add("ruang-hidup");
      sembunyikanAnchor();
      ukur();
      cam = target; // mulai tepat di posisi gulir, tanpa meluncur dari nol
      rafId = requestAnimationFrame(bingkai);
      const i = indeksDariHash(location.hash);
      if (i >= 0) {
        selamKe(i, false);
        cam = target;
        // Sekali lagi sesudah load, kalau ada yang sempat menggeser gulir.
        window.addEventListener("load", () => selamKe(i, false), { once: true });
      }
    }
    function matikan() {
      if (!hidup) return;
      hidup = false;
      cancelAnimationFrame(rafId);
      pulihkanAnchor();
      wadah!.classList.remove("ruang-hidup", "ruang-dalam");
      wadah!.style.height = "";
      elLapisan.forEach((el) => {
        el.style.transform = "";
        el.style.opacity = "";
        el.style.filter = "";
        el.classList.remove("ruang-fokus");
      });
      ctx!.clearRect(0, 0, kanvas!.width, kanvas!.height);
    }
    function sesuaikan() {
      if (bolehHidup()) {
        if (hidup) ukur();
        else nyalakan();
      } else matikan();
    }

    let tunda: ReturnType<typeof setTimeout> | undefined;
    const ukurUlang = () => {
      clearTimeout(tunda);
      tunda = setTimeout(sesuaikan, 200);
    };

    window.addEventListener("scroll", bacaGulir, { passive: true });
    window.addEventListener("resize", ukurUlang);
    window.addEventListener("hashchange", hashBerubah);
    document.addEventListener("click", klikAnchor, true);
    wadah.addEventListener("focusin", fokusMasuk);

    // Mulai setelah font siap: ukuran kata di kanvas dan tinggi lapisan (untuk
    // faktor muat) sama-sama bergantung padanya.
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(sesuaikan);

    return () => {
      matikan();
      clearTimeout(tunda);
      window.removeEventListener("scroll", bacaGulir);
      window.removeEventListener("resize", ukurUlang);
      window.removeEventListener("hashchange", hashBerubah);
      document.removeEventListener("click", klikAnchor, true);
      wadah.removeEventListener("focusin", fokusMasuk);
    };
  }, []);

  return (
    <div ref={wadahRef} data-surface="ruang" className="ruang band-navy-glow">
      <div className="ruang-panggung band-navy-glow">
        <canvas ref={kanvasRef} className="ruang-kanvas" aria-hidden />
        {children}

        {/* Rel kedalaman: posisi sekaligus navigasi. Namanya muncul saat
            hover/fokus; titik yang menyala = lapisan yang sedang difokus. */}
        <nav className="ruang-rel" aria-label="Bagian beranda">
          {lapisan.map((l, i) => (
            <button key={l.nama} type="button" onClick={() => selamRef.current(i)}>
              <i aria-hidden />
              <span>{l.nama}</span>
            </button>
          ))}
        </nav>

        {/* Petunjuk: hilang begitu pengguna mulai menyelam. */}
        <p className="ruang-petunjuk" aria-hidden>
          <i />
          Gulir untuk menyelam
        </p>
      </div>
    </div>
  );
}
