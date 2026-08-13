import type { Config } from "tailwindcss";

/**
 * Warna dibaca dari custom property di globals.css, bukan ditulis sebagai hex
 * di sini. Bentuk `rgb(var(--x) / <alpha-value>)` penting: tanpa itu, sintaks
 * alfa yang sudah dipakai ratusan kali (`ring-navy-900/10`, `bg-brand-blue/10`)
 * akan berhenti bekerja begitu warnanya jadi variabel.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Angka, label, ID, dan baris keterangan metadata.
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      /**
       * Skala tipografi.
       *
       * Sebelumnya tidak ada skala sama sekali: 437 dari 547 deklarasi ukuran
       * (80%) adalah text-sm atau text-xs, dan text-base muncul tiga kali di
       * seluruh aplikasi. Pemasaran melompat dari text-sm langsung ke text-7xl.
       *
       * Tracking merapat seiring ukuran membesar — inilah detail yang membuat
       * judul besar terlihat disetel, bukan sekadar diperbesar.
       */
      fontSize: {
        "display-1": [
          "clamp(2.375rem, 6.6vw, 5rem)",
          { lineHeight: "1.04", letterSpacing: "-0.024em", fontWeight: "600" },
        ],
        "display-2": [
          "clamp(1.8125rem, 4.6vw, 3.25rem)",
          { lineHeight: "1.07", letterSpacing: "-0.022em", fontWeight: "600" },
        ],
        // Sub-judul hero. Ukuran yang selama ini hilang: hero terasa kecil
        // bukan karena judulnya kurang besar, tapi karena barisan ini 18px.
        lead: [
          "clamp(1.125rem, 2.2vw, 1.625rem)",
          { lineHeight: "1.36", letterSpacing: "-0.012em" },
        ],
        "title-1": [
          "2rem",
          { lineHeight: "1.08", letterSpacing: "-0.032em", fontWeight: "600" },
        ],
        "title-2": [
          "1.25rem",
          { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" },
        ],
        "body-lg": ["1.0625rem", { lineHeight: "1.5", letterSpacing: "-0.003em" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        caption: ["0.75rem", { lineHeight: "1.5" }],
        label: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.085em" }],
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        action: "var(--radius-action)",
        chip: "var(--radius-chip)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
      },
      spacing: {
        // Irama vertikal antar bagian: 72px di aplikasi, 104px di pemasaran.
        band: "var(--band)",
      },
      maxWidth: {
        band: "980px",
      },
      /**
       * Urutan "AI sedang menulis metadata" di kartu hero.
       *
       * Setiap animasi memakai fill-mode `both`, dan keadaan `from`-lah yang
       * menyembunyikan elemen — BUKAN kelas `opacity-0` di markup. Itu penting:
       * dengan begini `motion-reduce:animate-none` membuat elemennya langsung
       * terlihat utuh, bukan hilang permanen bagi orang yang mematikan animasi.
       */
      keyframes: {
        "nerona-rise": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        "nerona-pop": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "none" },
        },
        // Amber selama "menganalisis", lalu hijau begitu metadatanya jadi.
        "nerona-done": {
          "0%, 55%": { backgroundColor: "#f59e0b", transform: "scale(1)" },
          "70%": { transform: "scale(1.5)" },
          "100%": { backgroundColor: "#34d399", transform: "scale(1)" },
        },
      },
      animation: {
        "nerona-rise": "nerona-rise 600ms ease-out both",
        "nerona-pop": "nerona-pop 400ms ease-out both",
        "nerona-done": "nerona-done 1900ms ease-in-out both",
      },
      colors: {
        // Perhentian gradien logo, plus varian aman-kontras untuk teks di
        // atas putih. Yang -ink sebelumnya hex lepas di enam berkas.
        brand: {
          sky: token("brand-sky"),
          blue: token("brand-blue"),
          gold: token("brand-gold"),
          orange: token("brand-orange"),
          "sky-ink": token("brand-sky-ink"),
          "blue-ink": token("brand-blue-ink"),
          "gold-ink": token("brand-gold-ink"),
          "orange-ink": token("brand-orange-ink"),
        },

        canvas: token("canvas"),
        surface: token("surface"),
        "surface-sunken": token("surface-sunken"),
        // Alias sementara. 57 pemanggilan `from-surface to-surface2` masih
        // hidup sampai Gelombang 4; alias ini dihapus di Gelombang 5.
        surface2: token("surface-sunken"),

        ink: token("ink"),
        muted: token("muted"),
        border: token("border"),
        divider: token("divider"),
        accent: token("accent"),
        emphasis: token("emphasis"),
        action: token("action"),
        "on-action": token("on-action"),

        // Peran semantik yang selama ini tidak punya token, sehingga rose dan
        // emerald melayang antara langkah 400 sampai 800 di 40+ berkas.
        success: token("success"),
        "success-bg": token("success-bg"),
        warning: token("warning"),
        "warning-bg": token("warning-bg"),
        danger: token("danger"),
        "danger-bg": token("danger-bg"),

        // Masih dibutuhkan pita gelap pemasaran dan CtaBanner. Berhenti
        // dipakai untuk garis batas.
        navy: {
          100: "#C7CDEB",
          300: "#8B93C9",
          500: "#3D44A8",
          700: "#10107A",
          800: "#0A0A5C",
          900: "#16233D",
          950: "#000024",
        },
        // Gradien emas bertahan hanya di dalam aplikasi, menandai aksi yang
        // menggerakkan uang. Halaman publik tidak memakainya sama sekali.
        gold: {
          300: "#FFE08A",
          400: "#FFCB5C",
          500: "#FF9E42",
          600: "#FF8B45",
        },
      },
    },
  },
  plugins: [],
};

export default config;
