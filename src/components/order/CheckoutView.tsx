"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingTierFeature } from "@/components/marketing/PricingTiers";

interface CheckoutViewProps {
  product: "metadata" | "agent";
  planName: string;
  durationMonths: number;
  durationLabel: string;
  priceLabel: string;
  savingsLabel?: string | null;
  features: PricingTierFeature[];
}

export function CheckoutView({
  product,
  planName,
  durationMonths,
  durationLabel,
  priceLabel,
  savingsLabel,
  features,
}: CheckoutViewProps) {
  const router = useRouter();
  const [contactNote, setContactNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy() {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product,
        planName,
        durationMonths,
        contactNote: contactNote || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data.orderId) {
      setSubmitting(false);
      setError(data?.message || "Gagal membuat order. Coba lagi.");
      return;
    }
    router.push(`/order/${data.orderId}`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Left — payment method */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bayar dengan</p>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-brand-blue bg-brand-blue/5 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/15 text-brand-blue">
            🏦
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Transfer Bank</p>
            <p className="text-xs text-muted">
              Setelah kirim order, kami tampilkan nomor rekening tujuan.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor="contactNote" className="text-xs font-medium text-muted">
            Nomor WhatsApp (opsional) — agar tim kami mudah menghubungi Anda
          </label>
          <input
            id="contactNote"
            type="text"
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            placeholder="mis. 0812-3456-7890"
            className="mt-2 w-full rounded-xl bg-navy-900/5 px-3 py-2.5 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
        </div>
      </div>

      {/* Right — plan summary */}
      <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {product === "metadata" ? "Nerona Metadata" : "Nerona Agent"}
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-ink">Paket {planName}</h2>
        <p className="mt-1 text-xs font-medium text-muted">Durasi {durationLabel}</p>

        <ul className="mt-4 space-y-2 text-[13px] text-ink">
          {features.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2">
              <span
                className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-bold ${
                  feature.included
                    ? "bg-emerald-400/15 text-emerald-500"
                    : "bg-rose-400/10 text-rose-500"
                }`}
                aria-hidden="true"
              >
                {feature.included ? "✓" : "✕"}
              </span>
              <span className={feature.included ? "" : "text-muted line-through"}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t border-navy-900/10 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="text-lg font-extrabold text-brand-blue">{priceLabel}</span>
          </div>
          {savingsLabel && (
            <p className="mt-1 text-right text-xs font-medium text-emerald-600">{savingsLabel}</p>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}

        <button
          onClick={handleBuy}
          disabled={submitting}
          className="mt-5 w-full rounded-full bg-gradient-to-br from-gold-500 to-gold-400 py-3 text-sm font-bold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Memproses..." : "Beli"}
        </button>
        <p className="mt-3 text-center text-xs text-muted/80">
          Pembayaran via transfer bank. Paket aktif setelah pembayaran dikonfirmasi admin.
        </p>
      </div>
    </div>
  );
}
