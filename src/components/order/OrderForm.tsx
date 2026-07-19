"use client";

import { useState } from "react";
import Link from "next/link";

interface OrderFormProps {
  product: "metadata" | "agent";
  planName: string;
  priceLabel: string;
  isFree: boolean;
}

const inputClass =
  "w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-navy-300/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

export function OrderForm({ product, planName, priceLabel, isFree }: OrderFormProps) {
  const [contactNote, setContactNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"free_activated" | "request_created" | null>(null);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, planName, contactNote: contactNote || undefined }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal mengirim order. Coba lagi.");
      return;
    }
    setDone(data.kind);
  }

  if (done === "free_activated") {
    return (
      <div className="rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-8 text-center ring-1 ring-gold-400/40">
        <p className="text-3xl" aria-hidden="true">
          🎉
        </p>
        <h2 className="mt-3 text-lg font-bold text-white">Paket Free aktif!</h2>
        <p className="mt-2 text-sm text-navy-300">
          {product === "metadata"
            ? "Lisensi Free Anda sudah dibuat — lihat kunci lisensi di halaman Account, lalu tempel di ekstensi Nerona Metadata."
            : "Nerona Agent Anda aktif — hubungkan nomor WhatsApp Anda dari dashboard untuk mulai chat."}
        </p>
        <Link
          href={product === "metadata" ? "/account" : "/agent/dashboard"}
          className="mt-6 inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-bold text-navy-900 transition hover:brightness-110"
        >
          {product === "metadata" ? "Buka Account" : "Buka Dashboard Agent"}
        </Link>
      </div>
    );
  }

  if (done === "request_created") {
    return (
      <div className="rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-8 text-center ring-1 ring-gold-400/40">
        <p className="text-3xl" aria-hidden="true">
          ✅
        </p>
        <h2 className="mt-3 text-lg font-bold text-white">Order terkirim!</h2>
        <p className="mt-2 text-sm text-navy-300">
          Tim Nerona akan menghubungi Anda untuk pembayaran. Setelah pembayaran diterima, paket{" "}
          {planName} Anda langsung diaktifkan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-8 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
            {product === "metadata" ? "Nerona Metadata" : "Nerona Agent"}
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-white">Paket {planName}</h2>
        </div>
        <p className="text-lg font-extrabold text-gold-400">{priceLabel}</p>
      </div>

      {!isFree && (
        <div className="mt-6">
          <label htmlFor="contactNote" className="text-xs font-medium text-navy-300">
            Kontak / catatan (opsional) — mis. nomor WhatsApp agar tim kami mudah menghubungi Anda
          </label>
          <textarea
            id="contactNote"
            rows={3}
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            placeholder="Contoh: WA 0812-3456-7890, transfer via BCA"
            className={`mt-2 ${inputClass}`}
          />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-gradient-to-br from-gold-500 to-gold-400 py-3 text-sm font-bold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
      >
        {submitting ? "Memproses..." : isFree ? "Aktifkan Gratis Sekarang" : "Kirim Order"}
      </button>

      {!isFree && (
        <p className="mt-4 text-center text-xs text-navy-300/80">
          Pembayaran dilakukan di luar platform (transfer bank). Paket aktif setelah pembayaran
          dikonfirmasi admin.
        </p>
      )}
    </div>
  );
}
