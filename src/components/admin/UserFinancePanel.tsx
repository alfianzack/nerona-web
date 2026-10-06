"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PageView, PurchaseView, TxnView } from "@/components/admin/UserDetailTabs";
import { pageHref } from "@/lib/pagination";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";

/**
 * Belum ada primitive untuk <select>. Bentuknya dijiplak dari Input — radius
 * kendali, cincin border, dan cincin fokus aksen yang sama — supaya pemilih
 * "Aksi" berdiri sejajar dengan kedua isian di baris yang sama.
 */
const selectClass =
  "rounded-control bg-surface px-3.5 py-2.5 text-body text-ink ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-accent";

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
  transactions: PageView<TxnView>;
  purchases: PageView<PurchaseView>;
  query: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshing, startRefresh] = useTransition();
  const [balance, setBalance] = useState(props.initialBalance);
  const transactions = props.transactions.rows;
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

    // Riwayatnya dimuat ulang dari server, bukan disisipi baris tebakan:
    // daftarnya kini berhalaman, dan baris sisipan di halaman 3 akan tampil di
    // tempat yang salah sekaligus menggeser hitungan "dari N".
    setBalance(data.balance);
    startRefresh(() => router.refresh());
    setAmount("");
    setNote("");
  }

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-title-2 text-ink">Poin</h3>
          <span className="font-mono text-title-2 tabular-nums text-ink">
            {balance.toLocaleString("id-ID")} poin
          </span>
        </div>

        {/* Field membawa label, isian, dan sambungan aria-nya sebagai satu
            benda. Versi sebelumnya membungkus isian di dalam <label> tanpa
            htmlFor, jadi labelnya tidak pernah benar-benar tersambung bagi
            pembaca layar. Pemilih "Aksi" tetap dijahit tangan karena Field
            hanya melayani <input>. */}
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="poin-aksi" className="text-caption font-medium text-muted">
              Aksi
            </label>
            <select
              id="poin-aksi"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "add" | "sub")}
              className={selectClass}
            >
              <option value="add">Tambah</option>
              <option value="sub">Kurangi</option>
            </select>
          </div>
          <Field
            id="poin-jumlah"
            label="Jumlah"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-28"
          />
          <Field
            id="poin-catatan"
            label="Catatan (opsional)"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="mis. bonus promo"
            className="flex-1"
          />
          {/* Menyesuaikan poin memang menyentuh saldo, tapi tidak ada uang yang
              berpindah di sini — emas disimpan untuk top-up dan pembayaran. */}
          <Button type="submit" disabled={loading || refreshing}>
            {loading || refreshing ? "..." : "Simpan"}
          </Button>
        </form>
        {error && <p className="mt-2 text-caption text-danger">{error}</p>}

        <div className="mt-6">
          <h4 className="font-mono text-label uppercase text-muted">Riwayat poin</h4>
          {transactions.length === 0 ? (
            <p className="mt-2 text-body text-muted">Belum ada transaksi poin.</p>
          ) : (
            <ul className="mt-2 divide-y divide-divider">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-body text-ink">
                      {reasonLabel(t.reason)}
                      {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                    </p>
                    {/* Baris keterangan pakai mono huruf kecil biasa: isinya
                        tanggal dan nama, bukan label kolom. */}
                    <p className="mt-0.5 font-mono text-label text-muted">
                      {fmtDate(t.createdAt)}
                      {t.createdByName ? ` · ${t.createdByName}` : ""}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap font-mono text-body font-semibold tabular-nums ${
                      t.delta >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {t.delta >= 0 ? "+" : ""}
                    {t.delta.toLocaleString("id-ID")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            className="mt-3 border-t border-divider pt-3"
            page={props.transactions.page}
            total={props.transactions.total}
            noun="transaksi"
            hrefFor={(p) => pageHref(pathname, props.query, "poin", p)}
          />
        </div>
      </Card>

      <Card padding="lg">
        <h3 className="text-title-2 text-ink">Pembelian</h3>
        {props.purchases.rows.length === 0 ? (
          <p className="mt-2 text-body text-muted">Belum ada pembelian.</p>
        ) : (
          <ul className="mt-4 divide-y divide-divider">
            {props.purchases.rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-body text-ink">{p.label}</p>
                  <p className="mt-0.5 font-mono text-label text-muted">
                    {fmtDate(p.date)}
                    {p.detail ? ` · ${p.detail}` : ""}
                  </p>
                </div>
                {p.amount != null && (
                  <span className="whitespace-nowrap font-mono text-body tabular-nums text-ink">
                    Rp {p.amount.toLocaleString("id-ID")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination
          className="mt-3 border-t border-divider pt-3"
          page={props.purchases.page}
          total={props.purchases.total}
          noun="pembelian"
          hrefFor={(p) => pageHref(pathname, props.query, "beli", p)}
        />
      </Card>
    </div>
  );
}
