"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Panel prompt Nerona — owner saja.
 *
 * Pemeriksaan peran di sini hanya demi tampilan; yang berwenang tetap
 * /api/admin/prompts, yang menolak `support` dengan 403.
 *
 * Sejak panel ini ada, prompt yang berjalan di produksi bisa berbeda dari yang
 * tertulis di kode, dan tests/lib/extension-prompts.test.ts hanya menjaga
 * bawaannya. Itu sebabnya lencana "Dioverride" ada: perbedaan itu tidak boleh
 * jadi kejutan saat menelusuri keluhan hasil.
 */
const ISIAN =
  "w-full rounded-control bg-surface px-3.5 py-2.5 font-mono text-caption text-ink transition " +
  "ring-1 ring-border placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent";

type Field = "advanced" | "contract";

export function AdminPromptPanel() {
  const [advanced, setAdvanced] = useState("");
  const [contract, setContract] = useState("");
  const [overridden, setOverridden] = useState({ advanced: false, contract: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function muat() {
    setLoading(true);
    const res = await fetch("/api/admin/prompts");
    const data = await res.json().catch(() => null);
    if (res.status === 403) {
      setError("Hanya owner yang bisa membuka prompt Nerona.");
    } else if (!res.ok || !data?.ok) {
      setError("Gagal memuat prompt.");
    } else {
      setAdvanced(data.settings.advanced);
      setContract(data.settings.contract);
      setOverridden({
        advanced: data.settings.advancedOverridden,
        contract: data.settings.contractOverridden,
      });
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void muat();
  }, []);

  async function kirim(values: Partial<Record<Field, string>>) {
    setBusy(true);
    setSaved(false);
    setError("");
    const res = await fetch("/api/admin/prompts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menyimpan.");
      return;
    }
    setSaved(true);
    await muat();
  }

  return (
    <Card padding="lg">
      <h2 className="text-title-2 text-ink">Prompt Metadata Nerona</h2>
      <p className="mt-1 max-w-prose text-body text-muted">
        Prompt bawaan yang dipakai setiap tenant yang belum memasang prompt sendiri. Tidak pernah
        ditampilkan di sisi tenant. Kosongkan lalu simpan untuk kembali ke bawaan versi kode.
      </p>

      {loading ? (
        <p className="mt-4 text-body text-muted">Memuat…</p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="prompt-advanced" className="text-caption font-medium text-muted">
                Badan prompt (mode advanced)
              </label>
              {overridden.advanced && <Badge tone="warning">Dioverride</Badge>}
            </div>
            <textarea
              id="prompt-advanced"
              rows={16}
              className={ISIAN}
              value={advanced}
              onChange={(e) => setAdvanced(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => kirim({ advanced })} disabled={busy}>
                Simpan badan
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => kirim({ advanced: "" })}
                disabled={busy || !overridden.advanced}
              >
                Kembalikan ke bawaan
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="prompt-contract" className="text-caption font-medium text-muted">
                Ekor kontrak (hanya untuk prompt kustom tenant)
              </label>
              {overridden.contract && <Badge tone="warning">Dioverride</Badge>}
            </div>
            <textarea
              id="prompt-contract"
              rows={10}
              className={ISIAN}
              value={contract}
              onChange={(e) => setContract(e.target.value)}
            />
            <p className="max-w-prose text-caption text-muted">
              Ditempel di akhir prompt tenant. Ia yang menjaga keluaran tetap JSON yang bisa dibaca
              extension dan Hub — dan yang menahan endpoint generate dipakai sebagai LLM serbaguna.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => kirim({ contract })} disabled={busy}>
                Simpan ekor
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => kirim({ contract: "" })}
                disabled={busy || !overridden.contract}
              >
                Kembalikan ke bawaan
              </Button>
            </div>
          </div>
        </div>
      )}

      {saved && <p className="mt-4 text-caption text-success">Tersimpan.</p>}
      {error && <p className="mt-4 text-caption text-danger">{error}</p>}
    </Card>
  );
}
