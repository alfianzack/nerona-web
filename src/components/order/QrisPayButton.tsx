"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PESAN: Record<string, string> = {
  disabled: "Pembayaran QRIS sedang dimatikan. Pakai transfer manual di bawah.",
  not_configured: "Pembayaran QRIS belum dikonfigurasi. Pakai transfer manual di bawah.",
  order_not_found: "Order tidak ditemukan. Muat ulang halaman ini.",
  not_pending: "Order ini sudah selesai atau dibatalkan.",
  no_price: "Harga paket ini belum diatur, jadi belum bisa dibayar otomatis. Hubungi admin.",
  gateway_error:
    "Penyedia pembayaran sedang tidak bisa dihubungi. Coba lagi, atau pakai transfer manual.",
};

/**
 * Menyiapkan tagihan QRIS, lalu membuka halaman bayar SumoPod di tab baru.
 *
 * Tab baru, bukan tab yang sama: halaman order inilah yang tahu kapan
 * pembayarannya masuk (lewat webhook) dan memegang jalan mundur ke transfer
 * manual. Pengguna yang menutup tab bayar mendapati halaman ini masih terbuka
 * dan menyegarkan dirinya sendiri.
 *
 * `window.open` dipanggil di dalam handler klik — tanpa `await` di antaranya —
 * karena browser memblokir jendela baru yang dibuka setelah rantai `await`.
 * Itu sebabnya menyiapkan tagihan dan membukanya adalah dua langkah terpisah:
 * yang pertama membuat tautannya ada, yang kedua tautan biasa yang diklik.
 */
export function QrisPayButton({
  orderId,
  tautanAktif,
  kedaluwarsa,
}: {
  orderId: string;
  /** Tautan bayar yang sudah dibuat dan masih hidup, kalau ada. */
  tautanAktif: string | null;
  kedaluwarsa: string | null;
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function siapkan() {
    setGalat("");
    setSibuk(true);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.linkUrl) {
        setSibuk(false);
        setGalat(PESAN[data?.reason ?? ""] ?? "Gagal menyiapkan pembayaran. Coba lagi sebentar.");
        return;
      }
    } catch {
      setSibuk(false);
      setGalat("Koneksi bermasalah. Coba lagi, atau pakai transfer manual.");
      return;
    }
    // Halaman dimuat ulang supaya tautan bayarnya dirender server sebagai <a>
    // biasa. Membuka jendela dari sini akan diblokir browser karena sudah lewat
    // beberapa `await` sejak kliknya.
    router.refresh();
  }

  if (tautanAktif) {
    return (
      <div>
        <a
          href={tautanAktif}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2.5 text-sm font-semibold text-navy-900 transition hover:brightness-110"
        >
          Buka halaman pembayaran QRIS ↗
        </a>
        {kedaluwarsa && (
          <p className="mt-2 text-xs text-muted">Tautan bayar berlaku sampai {kedaluwarsa}.</p>
        )}
        <p className="mt-2 text-xs text-muted">
          Tab baru akan terbuka. Setelah membayar, tutup tab itu — halaman ini memperbarui
          statusnya sendiri. Paket aktif tanpa perlu mengunggah bukti.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={siapkan}
        disabled={sibuk}
        className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
      >
        {sibuk ? "Menyiapkan QRIS..." : "Siapkan pembayaran QRIS"}
      </button>
      {galat && <p className="mt-2 text-sm text-rose-500">{galat}</p>}
    </div>
  );
}
