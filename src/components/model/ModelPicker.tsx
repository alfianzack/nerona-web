"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface ModelOption {
  id: string;
  label: string;
  note: string | null;
  estimatedPoints: number;
  isDefault: boolean;
}

export function ModelPicker() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tier, setTier] = useState<"free" | "pro" | "business">("business");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function muat() {
    setLoading(true);
    const res = await fetch("/api/model");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat daftar model.");
    } else {
      setModels(data.models);
      setSelectedId(data.selectedId);
      setTier(data.tier === "free" || data.tier === "pro" ? data.tier : "business");
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void muat();
  }, []);

  async function pilih(modelId: string | null) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/model", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelId }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menyimpan pilihan.");
      return;
    }
    await muat();
  }

  if (loading) {
    return (
      <Card padding="lg">
        <p className="text-body text-muted">Memuat…</p>
      </Card>
    );
  }

  // Registri kosong bukan galat — artinya Nerona belum menawarkan pilihan, dan
  // semua generate memakai model bawaan seperti biasa.
  if (models.length === 0) {
    return (
      <Card padding="lg">
        <h2 className="text-title-2 text-ink">Belum ada pilihan model</h2>
        <p className="mt-1 max-w-prose text-body text-muted">
          Semua generate memakai model bawaan Nerona. Kalau nanti ada beberapa pilihan, halaman ini
          yang jadi tempat memilihnya.
        </p>
        {error && <p className="mt-4 text-caption text-danger">{error}</p>}
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card padding="lg">
        <h2 className="text-title-2 text-ink">Model yang dipakai</h2>
        <p className="mt-1 max-w-prose text-body text-muted">
          Berlaku untuk semua generate Anda, di extension maupun Nerona Hub. Angka poin di bawah
          adalah <strong className="font-medium text-ink">perkiraan</strong> untuk satu gambar —
          ongkos sebenarnya dihitung dari token yang benar-benar terpakai, jadi bisa naik-turun
          sedikit.
        </p>

        <ul className="mt-5 grid gap-2">
          {models.map((model) => {
            const active = model.id === selectedId || (selectedId === null && model.isDefault);
            return (
              <li
                key={model.id}
                className={
                  "flex flex-wrap items-center justify-between gap-3 rounded-control px-3.5 py-3 ring-1 " +
                  (active ? "ring-2 ring-accent" : "ring-border")
                }
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-medium text-ink">{model.label}</span>
                    {active && <Badge tone="success">Dipakai</Badge>}
                    {model.isDefault && <Badge tone="neutral">Bawaan</Badge>}
                  </div>
                  {model.note && <p className="mt-0.5 text-caption text-muted">{model.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone="points">
                    ± {model.estimatedPoints.toLocaleString("id-ID")} poin / gambar
                  </Badge>
                  {!active && (
                    <Button size="sm" onClick={() => pilih(model.id)} disabled={busy}>
                      Pakai ini
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {selectedId !== null && (
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => pilih(null)} disabled={busy}>
              Kembali ke model bawaan Nerona
            </Button>
          </div>
        )}

        {/* Ditampilkan untuk Pro juga, bukan hanya Free: sejak gerbangnya per
            paket, Pro pun bisa punya model yang tidak terlihat olehnya. */}
        {tier !== "business" && (
          <p className="mt-4 max-w-prose text-caption text-muted">
            Sebagian model hanya untuk paket yang lebih tinggi dan tidak ditampilkan di sini.
          </p>
        )}

        {error && <p className="mt-4 text-caption text-danger">{error}</p>}
      </Card>
    </div>
  );
}
