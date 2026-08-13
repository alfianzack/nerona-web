"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/icons";

interface PlanPointsRow {
  product: "metadata" | "agent";
  plan: string;
  label: string;
  stored: string;
  effective: number;
}

/**
 * Nama produk dan ikonnya dipisah.
 *
 * Sebelumnya keduanya menyatu sebagai satu string berisi emoji ("🖼️ Metadata").
 * Emoji digambar oleh sistem operasi, jadi bentuk, bobot, dan warnanya berbeda
 * di tiap mesin dan tidak pernah ikut warna teks di sekitarnya — persis hal
 * yang tidak boleh terjadi pada penanda produk. Peta ini milik berkas tampilan,
 * bukan src/lib, jadi memisahkannya tidak menyentuh data mana pun.
 */
const PRODUCT_TITLES: Record<string, string> = {
  metadata: "Metadata",
  agent: "Agent",
};
const PRODUCT_ICONS: Record<string, IconName> = {
  metadata: "image",
  agent: "chat",
};

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
    <Card padding="lg">
      <h2 className="text-title-2 text-ink">Poin per paket</h2>
      <p className="mt-1 text-caption text-muted">
        Poin yang diberikan saat paket diaktifkan atau diperpanjang. Kosongkan untuk pakai default.
      </p>

      {error && (
        <p className="mt-4 rounded-card bg-danger-bg px-3 py-2 text-caption text-danger ring-1 ring-danger/25">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {products.map((product) => {
          const productRows = rows.filter((row) => row.product === product);
          if (productRows.length === 0) return null;
          return (
            <div key={product}>
              <p className="flex items-center gap-1.5 font-mono text-label uppercase text-muted">
                <Icon name={PRODUCT_ICONS[product]} className="h-3.5 w-3.5 flex-none" />
                {PRODUCT_TITLES[product]}
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {productRows.map((row) => {
                  const id = `points-${row.product}-${row.plan}`;
                  return (
                    /*
                      Mono ditaruh di pembungkus Field, bukan di kolomnya:
                      Field tidak meneruskan kelas ke elemen isian, dan angka
                      poin yang diketik mewarisi hurufnya dari sini. Label dan
                      baris "Berlaku" ikut mono — memang begitu yang diminta
                      untuk label dan keterangan.
                    */
                    <Field
                      key={keyOf(row)}
                      id={id}
                      label={row.label}
                      hint={`Berlaku: ${row.effective.toLocaleString("id-ID")} poin`}
                      className="font-mono tabular-nums"
                      type="text"
                      inputMode="numeric"
                      value={drafts[keyOf(row)] ?? ""}
                      onChange={(e) => {
                        // Penanda "Tersimpan" dimatikan begitu isinya berbeda
                        // dari yang tersimpan, supaya ia tidak pernah mengaku
                        // nilai yang baru diketik sudah ikut tersimpan.
                        setSaved(false);
                        setDrafts((prev) => ({ ...prev, [keyOf(row)]: e.target.value }));
                      }}
                      placeholder={String(row.effective)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan poin paket"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 font-mono text-label uppercase text-success">
            <Icon name="check" className="h-4 w-4 flex-none" />
            Tersimpan
          </span>
        )}
      </div>
    </Card>
  );
}
