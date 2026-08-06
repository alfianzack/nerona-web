"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PESAN: Record<string, string> = {
  disabled: "Pembayaran QRIS sedang dimatikan. Pakai transfer manual di bawah.",
  not_configured: "Pembayaran QRIS belum dikonfigurasi. Pakai transfer manual di bawah.",
  order_not_found: "Order tidak ditemukan. Muat ulang halaman ini.",
  not_pending: "Order ini sudah selesai atau dibatalkan.",
  no_price: "Harga paket ini belum diatur, jadi belum bisa dibayar otomatis. Hubungi admin.",
  gateway_error: "Penyedia pembayaran sedang tidak bisa dihubungi. Coba lagi, atau pakai transfer manual di bawah.",
};

/**
 * Membuat tagihan QRIS lalu membuka halaman bayarnya di tab baru.
 *
 * Tab baru, bukan pengalihan: halaman ini yang memegang detail transfer manual
 * dan tombol unggah bukti, dan pengguna yang batal membayar harus menemukannya
 * masih terbuka — bukan harus menekan tombol kembali dari situs pihak ketiga.
 */
export function QrisPayButton({
  orderId,
  tautanAktif,
  kedaluwarsa,
}: {
  orderId: string;
  /** Tautan yang sudah dibuat dan masih hidup, kalau ada. */
  tautanAktif: string | null;
  kedaluwarsa: string | null;
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function bayar() {
    setGalat("");
    setSibuk(true);
    let data: { ok?: boolean; linkUrl?: string; reason?: string } | null = null;
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.linkUrl) {
        setSibuk(false);
        setGalat(PESAN[data?.reason ?? ""] ?? "Gagal membuat pembayaran. Coba lagi sebentar.");
        return;
      }
    } catch {
      setSibuk(false);
      setGalat("Koneksi bermasalah. Coba lagi, atau pakai transfer manual di bawah.");
      return;
    }
    // Muat ulang halaman ini, bukan buka tab SumoPod: begitu tagihannya ada,
    // server bisa menggambar QR-nya sendiri di sini. Pengguna tidak perlu
    // meninggalkan halaman order untuk membayar, dan tidak perlu kembali untuk
    // melihat hasilnya.
    //
    // `sibuk` dibiarkan menyala sampai render berikutnya selesai — tombol yang
    // hidup kembali di detik ini mengundang klik kedua yang membuat tagihan
    // kedua untuk satu order.
    router.refresh();
  }

  return (
    <div>
      {/*
        Tautan hanya muncul kalau tagihannya ada TAPI QR-nya tidak bisa digambar
        — misalnya gateway mengembalikan nomor VA alih-alih muatan QRIS. Kalau
        QR-nya ada, halaman order menggambarnya sendiri dan tombol ini tidak
        dirender sama sekali.
      */}
      {tautanAktif ? (
        <a
          href={tautanAktif}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2.5 text-sm font-semibold text-navy-900 transition hover:brightness-110"
        >
          Buka halaman bayar ↗
        </a>
      ) : (
        <button
          type="button"
          onClick={bayar}
          disabled={sibuk}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {sibuk ? "Menyiapkan QRIS..." : "Tampilkan QRIS"}
        </button>
      )}

      {kedaluwarsa && (
        <p className="mt-2 text-xs text-muted">Tautan bayar berlaku sampai {kedaluwarsa}.</p>
      )}
      {galat && <p className="mt-2 text-sm text-rose-500">{galat}</p>}
      <p className="mt-2 text-xs text-muted">
        Setelah pembayaran masuk, paket aktif sendiri dalam beberapa detik — tidak perlu
        mengunggah bukti.
      </p>
    </div>
  );
}
