import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
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
      // Light brand palette derived from the Pill-N logo: a sky→blue and a
      // gold→orange gradient on a soft, sky-tinted off-white ground.
      colors: {
        // Logo gradient stops, reusable as solid accents.
        brand: {
          sky: "#6EC9F2",
          blue: "#4A7DE8",
          gold: "#FFD65C",
          orange: "#FF8B45",
        },
        // Surfaces & text (semantic tokens).
        canvas: "#EEF4FB", // page background
        surface: "#FFFFFF", // cards, panels
        surface2: "#F4F8FD", // subtle gradient bottom / lifted sections
        ink: "#16233D", // primary text (blue-biased near-black)
        muted: "#5C6B85", // secondary text
        // Kept for dark text on gold buttons/badges and low-opacity lines.
        navy: {
          100: "#C7CDEB",
          300: "#8B93C9",
          500: "#3D44A8",
          700: "#10107A",
          800: "#0A0A5C",
          900: "#16233D",
          950: "#000024",
        },
        // Warm accent, retuned to the logo's gold→orange for buttons & rings.
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
