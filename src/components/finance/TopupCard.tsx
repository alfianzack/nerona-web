"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TopupOption {
  points: number;
  price: number;
  priceLabel: string;
  perPointLabel: string;
}

export function TopupCard({
  options,
  hasActivePlan,
}: {
  options: TopupOption[];
  /**
   * Poin hanya bisa dipakai kalau ada paket aktif — /api/extension/generate
   * menolak dengan 403 untuk lisensi tidak aktif. Membiarkan orang membeli tanpa
   * memberi tahu itu berarti menjual sesuatu yang belum bisa mereka pakai.
   */
  hasActivePlan: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");

  async function buy(points: number) {
    setError("");
    setPending(points);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: "points", points }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data.orderId) {
      setPending(0);
      setError(data?.message || "Gagal membuat order. Coba lagi.");
      return;
    }
    router.push(`/order/${data.orderId}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Beli poin</h2>
        <span className="text-xs text-muted">Transfer bank · aktif setelah dikonfirmasi admin</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Poin yang dibeli tidak hangus dan menambah saldo yang ada.
      </p>

      {!hasActivePlan && (
        <p className="mt-3 rounded-xl bg-gold-400/15 px-3 py-2 text-xs text-[#9A6B08] ring-1 ring-gold-400/40">
          Anda belum punya paket aktif. Poin boleh dibeli sekarang, tapi baru bisa dipakai setelah
          paket Metadata atau Agent Anda aktif.
        </p>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <li
            key={option.points}
            className="flex flex-col rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10"
          >
            <p className="text-lg font-extrabold text-ink">
              {option.points.toLocaleString("id-ID")}
              <span className="ml-1 text-xs font-medium text-muted">poin</span>
            </p>
            <p className="mt-0.5 text-sm font-semibold text-brand-blue">{option.priceLabel}</p>
            <p className="mt-0.5 text-[11px] text-muted">{option.perPointLabel}</p>
            <button
              type="button"
              onClick={() => buy(option.points)}
              disabled={pending !== 0}
              className="mt-3 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 py-2 text-xs font-bold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
            >
              {pending === option.points ? "Memproses..." : "Beli"}
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
    </div>
  );
}
