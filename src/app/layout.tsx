import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AGENT_ENABLED } from "@/lib/features";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

/**
 * Deskripsi situs ikut saklar produk.
 *
 * Ini teks yang muncul di hasil pencarian dan pratinjau tautan — jadi
 * membiarkannya menyebut "asisten AI WhatsApp untuk pemilik bisnis" berarti
 * setiap orang yang menemukan Nerona lewat Google dijanjikan produk yang
 * halamannya sudah tidak ada. Satu-satunya salinan pemasaran yang berlaku di
 * SEMUA halaman, termasuk yang di dalam aplikasi.
 */
export const metadata: Metadata = {
  title: "Nerona",
  description: AGENT_ENABLED
    ? "Alat AI Nerona — metadata otomatis untuk kontributor stock, dan asisten AI WhatsApp untuk pemilik bisnis."
    : "Nerona Metadata — judul, deskripsi, dan kata kunci dibuat otomatis dengan AI, lalu diisi langsung ke formulir unggah marketplace stock Anda.",
};

// Chrome lives in the route group layouts: (marketing) has the topbar and
// footer, (app) and (admin) have the sidebar shell, (auth) has none.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
