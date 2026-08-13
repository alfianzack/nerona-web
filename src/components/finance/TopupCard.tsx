"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
        <h2 className="text-title-2 text-ink">Beli poin</h2>
        <span className="font-mono text-label uppercase text-muted">
          Transfer bank · aktif setelah dikonfirmasi admin
        </span>
      </div>
      <p className="mt-1 text-caption text-muted">
        Poin yang dibeli tidak hangus dan menambah saldo yang ada.
      </p>

      {/* Nada peringatan, bukan emas: ini syarat yang perlu dibaca sebelum
          membeli, dan emas di layar ini milik tombolnya. */}
      {!hasActivePlan && (
        <p className="mt-4 rounded-card bg-warning-bg px-3 py-2 text-caption text-warning ring-1 ring-warning/25">
          Anda belum punya paket aktif. Poin boleh dibeli sekarang, tapi baru bisa dipakai setelah
          paket Metadata atau Agent Anda aktif.
        </p>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <li key={option.points}>
            {/* Paket yang sedang diproses ditandai dengan varian accent, bukan
                cincin tambahan lewat className — menimpa cincin dari luar gagal
                secara diam-diam, sebabnya ditulis di Card.tsx. */}
            <Card
              variant={pending === option.points ? "accent" : "sunken"}
              padding="sm"
              className="flex h-full flex-col"
            >
              <p className="font-mono text-title-2 tabular-nums text-ink">
                {option.points.toLocaleString("id-ID")}
                <span className="ml-1 font-sans text-caption font-normal text-muted">poin</span>
              </p>
              <p className="mt-1 font-mono text-body font-semibold tabular-nums text-brand-blue-ink">
                {option.priceLabel}
              </p>
              <p className="mt-0.5 font-mono text-caption tabular-nums text-muted">
                {option.perPointLabel}
              </p>
              <Button
                variant="money"
                size="sm"
                full
                className="mt-4"
                onClick={() => buy(option.points)}
                disabled={pending !== 0}
              >
                {pending === option.points ? "Memproses..." : "Beli"}
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-body text-danger">{error}</p>}
    </div>
  );
}
