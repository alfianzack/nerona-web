import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  // Match the app's JSX runtime. tsconfig says "jsx": "preserve" because Next
  // does its own transform, which left esbuild defaulting to the classic
  // React.createElement runtime — and nothing in this codebase imports React,
  // so importing any .tsx with JSX outside a function body threw
  // "React is not defined" at module load.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
