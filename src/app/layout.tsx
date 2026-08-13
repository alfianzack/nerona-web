import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { AGENT_ENABLED } from "@/lib/features";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

/**
 * Satu-satunya huruf baru.
 *
 * Acuan tampilan halaman publik adalah apple.com, dan Apple memakai SF Pro —
 * yang tidak bisa dilisensikan untuk web di luar platformnya. Kerabat
 * terdekatnya adalah Inter, yang sudah terpasang di sini, jadi tidak ada huruf
 * judul baru sama sekali. Plex Mono hanya untuk angka, label, ID, dan baris
 * keterangan metadata: di sana ia mengerjakan sesuatu yang Inter tidak bisa,
 * yaitu membuat kolom angka benar-benar berbaris.
 */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

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
    <html lang="id" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
