import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
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
