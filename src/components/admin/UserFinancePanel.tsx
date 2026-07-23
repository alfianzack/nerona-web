"use client";

import { useState } from "react";
import type { PurchaseView, TxnView } from "@/components/admin/UserDetailTabs";

const cardClass =
  "rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10";
const inputClass =
  "rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";
const primaryBtn =
  "rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-3.5 py-1.5 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function reasonLabel(reason: string): string {
  if (reason === "manual_adjust") return "Penyesuaian admin";
  if (reason === "spend") return "Pemakaian AI";
  if (reason === "topup") return "Top-up";
  return reason;
}

export function UserFinancePanel(props: {
  userId: string;
  initialBalance: number;
  initialTransactions: TxnView[];
  purchases: PurchaseView[];
}) {
  const [balance, setBalance] = useState(props.initialBalance);
  const [transactions, setTransactions] = useState<TxnView[]>(props.initialTransactions);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"add" | "sub">("add");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const magnitude = Math.round(Number(amount));
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      setError("Masukkan jumlah poin yang valid.");
      return;
    }
    const delta = direction === "add" ? magnitude : -magnitude;

    setLoading(true);
    const res = await fetch("/api/admin/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: props.userId, delta, note: note.trim() || undefined }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menyesuaikan poin.");
      return;
    }

    setBalance(data.balance);
    setTransactions((prev) => [
      {
        id: `optimistic-${prev.length}-${delta}`,
        delta,
        reason: "manual_adjust",
        note: note.trim() || null,
        createdByName: "Kamu",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setAmount("");
    setNote("");
  }

  return (
    <div className="space-y-5">
      <section className={cardClass}>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-ink">Poin</h3>
          <span className="text-lg font-semibold tabular-nums text-ink">
            {balance.toLocaleString("id-ID")} poin
          </span>
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Aksi
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "add" | "sub")}
              className={inputClass}
            >
              <option value="add">Tambah</option>
              <option value="sub">Kurangi</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Jumlah
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${inputClass} w-28`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            Catatan (opsional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="mis. bonus promo"
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={loading} className={primaryBtn}>
            {loading ? "..." : "Simpan"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Riwayat poin</h4>
          {transactions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Belum ada transaksi poin.</p>
          ) : (
            <ul className="mt-2 divide-y divide-navy-900/10">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {reasonLabel(t.reason)}
                      {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {fmtDate(t.createdAt)}
                      {t.createdByName ? ` · ${t.createdByName}` : ""}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                      t.delta >= 0 ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {t.delta >= 0 ? "+" : ""}
                    {t.delta.toLocaleString("id-ID")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-sm font-semibold text-ink">Pembelian</h3>
        {props.purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada pembelian.</p>
        ) : (
          <ul className="mt-2 divide-y divide-navy-900/10">
            {props.purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{p.label}</p>
                  <p className="text-xs text-muted">
                    {fmtDate(p.date)}
                    {p.detail ? ` · ${p.detail}` : ""}
                  </p>
                </div>
                {p.amount != null && (
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-ink">
                    Rp {p.amount.toLocaleString("id-ID")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
