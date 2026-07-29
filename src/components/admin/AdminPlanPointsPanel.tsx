"use client";

import { useEffect, useState } from "react";

interface PlanPointsRow {
  product: "metadata" | "agent";
  plan: string;
  label: string;
  stored: string;
  effective: number;
}

const PRODUCT_TITLES: Record<string, string> = {
  metadata: "🖼️ Metadata",
  agent: "💬 Agent",
};

const inputClass =
  "w-full rounded-xl bg-surface px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 transition focus:outline-none focus:ring-2 focus:ring-brand-blue/40";

function keyOf(row: { product: string; plan: string }) {
  return `${row.product}:${row.plan}`;
}

export function AdminPlanPointsPanel() {
  const [rows, setRows] = useState<PlanPointsRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/plan-points");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat poin paket.");
      return;
    }
    setRows(data.rows);
    const next: Record<string, string> = {};
    for (const row of data.rows as PlanPointsRow[]) next[keyOf(row)] = row.stored;
    setDrafts(next);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    const res = await fetch("/api/admin/plan-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          product: row.product,
          plan: row.plan,
          value: drafts[keyOf(row)] ?? "",
        })),
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.message || "Gagal menyimpan poin paket.");
      return;
    }
    setSaved(true);
    load();
  }

  const products: Array<"metadata" | "agent"> = ["metadata", "agent"];

  return (
    <section className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-lg font-semibold text-ink">Poin per paket</h2>
      <p className="mt-1 text-xs text-muted">
        Poin yang diberikan saat paket diaktifkan atau diperpanjang. Kosongkan untuk pakai default.
      </p>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

      <div className="mt-4 space-y-5">
        {products.map((product) => {
          const productRows = rows.filter((row) => row.product === product);
          if (productRows.length === 0) return null;
          return (
            <div key={product}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {PRODUCT_TITLES[product]}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {productRows.map((row) => {
                  const id = `points-${row.product}-${row.plan}`;
                  return (
                    <div key={keyOf(row)}>
                      <label htmlFor={id} className="text-xs font-medium text-ink">
                        {row.label}
                      </label>
                      <input
                        id={id}
                        type="text"
                        inputMode="numeric"
                        value={drafts[keyOf(row)] ?? ""}
                        onChange={(e) => {
                          // Clear the badge the moment the field diverges from
                          // what is stored, so it cannot claim an edited value
                          // is saved.
                          setSaved(false);
                          setDrafts((prev) => ({ ...prev, [keyOf(row)]: e.target.value }));
                        }}
                        placeholder={String(row.effective)}
                        className={`mt-1 ${inputClass}`}
                      />
                      <p className="mt-1 text-[11px] text-muted/80">
                        Berlaku: {row.effective.toLocaleString("id-ID")} poin
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan poin paket"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">✓ Tersimpan</span>}
      </div>
    </section>
  );
}
