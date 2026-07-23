"use client";

import { useState } from "react";
import Link from "next/link";

interface FreeActivateCardProps {
  product: "metadata" | "agent";
  planName: string;
}

export function FreeActivateCard({ product, planName }: FreeActivateCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleActivate() {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, planName }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal mengaktifkan. Coba lagi.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-8 text-center shadow-lg shadow-navy-900/10 ring-1 ring-gold-400/40">
        <p className="text-3xl" aria-hidden="true">🎉</p>
        <h2 className="mt-3 text-lg font-bold text-ink">Paket Free aktif!</h2>
        <p className="mt-2 text-sm text-muted">
          {product === "metadata"
            ? "Lisensi Free Anda sudah dibuat — lihat kunci lisensi di halaman Akun."
            : "Nerona Agent Anda aktif — hubungkan nomor WhatsApp dari dashboard."}
        </p>
        <Link
          href={product === "metadata" ? "/account" : "/agent/dashboard"}
          className="mt-6 inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-bold text-navy-900 transition hover:brightness-110"
        >
          {product === "metadata" ? "Buka Akun" : "Buka Dashboard Agent"}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-8 text-center shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-xl font-extrabold text-ink">Paket {planName}</h2>
      <p className="mt-2 text-sm text-muted">Aktif seketika, tanpa pembayaran.</p>
      {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
      <button
        onClick={handleActivate}
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-gradient-to-br from-gold-500 to-gold-400 py-3 text-sm font-bold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
      >
        {submitting ? "Memproses..." : "Aktifkan Gratis Sekarang"}
      </button>
    </div>
  );
}
