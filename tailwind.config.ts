import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Brand palette: deep navy surfaces with gold accents. Navy steps are
      // surface levels (950 = page background, 900/800 = cards), not a full
      // perceptual scale.
      colors: {
        navy: {
          100: "#C7CDEB",
          300: "#8B93C9",
          500: "#3D44A8",
          700: "#10107A",
          800: "#0A0A5C",
          900: "#00044A",
          950: "#000024",
        },
        gold: {
          300: "#FFE066",
          400: "#FFD60A",
          500: "#FFBF1C",
          600: "#D1A309",
        },
      },
    },
  },
  plugins: [],
};

export default config;
