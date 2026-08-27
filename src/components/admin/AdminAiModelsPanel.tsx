"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { costForUsage } from "@/lib/agent/pricing";

/**
 * Registri model. Selama tabel ini kosong, semua panggilan memakai panel
 * "Koneksi AI" di sebelah — itu yang membuat fitur ini bisa dipasang tanpa
 * mengubah satu tagihan pun sampai Anda siap.
 *
 * Tarif yang dimasukkan harus tarif GATEWAY yang menagih Anda (SumoPod), bukan
 * harga resmi Anthropic/OpenAI/DeepSeek.
 */
const ISIAN_MONO = "[&_input]:font-mono";

interface ModelRow {
  id: string;
  label: string;
  modelId: string;
  note: string | null;
  inPerMTok: number;
  outPerMTok: number;
  vision: boolean;
  paidOnly: boolean;
  isDefault: boolean;
  active: boolean;
  baseUrl: string | null;
  apiKeySet: boolean;
  sortOrder: number;
}

const KOSONG = {
  label: "",
  modelId: "",
  note: "",
  inPerMTok: "",
  outPerMTok: "",
  baseUrl: "",
  apiKey: "",
  vision: true,
  paidOnly: false,
  active: true,
};

type Draft = typeof KOSONG;

/** Profil token acuan yang sama dengan lib/ai-models.ts. */
const REFERENCE_USAGE = { promptTokens: 1_200, completionTokens: 150 };

export function AdminAiModelsPanel() {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [pointsPerUsd, setPointsPerUsd] = useState(1_000);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(KOSONG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function muat() {
    setLoading(true);
    const [modelsRes, aiRes] = await Promise.all([
      fetch("/api/admin/ai-models"),
      fetch("/api/admin/ai-settings"),
    ]);
    const models = await modelsRes.json().catch(() => null);
    const ai = await aiRes.json().catch(() => null);
    if (!modelsRes.ok || !models?.ok) {
      setError("Gagal memuat daftar model.");
    } else {
      setRows(models.models);
      if (ai?.ok) setPointsPerUsd(ai.settings.effective.pointsPerUsd);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void muat();
  }, []);

  async function kirim(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menyimpan.");
      return false;
    }
    await muat();
    return true;
  }

  function bukaBaru() {
    setEditingId("");
    setDraft(KOSONG);
    setError("");
  }

  function bukaSunting(row: ModelRow) {
    setEditingId(row.id);
    setDraft({
      label: row.label,
      modelId: row.modelId,
      note: row.note || "",
      inPerMTok: String(row.inPerMTok),
      outPerMTok: String(row.outPerMTok),
      baseUrl: row.baseUrl || "",
      // Sengaja kosong: kunci tidak pernah dikirim balik utuh, jadi kosong di
      // sini berarti "biarkan yang tersimpan", bukan "hapus".
      apiKey: "",
      vision: row.vision,
      paidOnly: row.paidOnly,
      active: row.active,
    });
    setError("");
  }

  async function simpan() {
    const payload = {
      label: draft.label,
      modelId: draft.modelId,
      note: draft.note,
      inPerMTok: draft.inPerMTok,
      outPerMTok: draft.outPerMTok,
      baseUrl: draft.baseUrl,
      vision: draft.vision,
      paidOnly: draft.paidOnly,
      active: draft.active,
      ...(draft.apiKey.trim() ? { apiKey: draft.apiKey } : {}),
    };
    const ok =
      editingId === ""
        ? await kirim("/api/admin/ai-models", "POST", payload)
        : await kirim(`/api/admin/ai-models/${editingId}`, "PATCH", payload);
    if (ok) setEditingId(null);
  }

  function perkiraan(inPerMTok: number, outPerMTok: number): number {
    return costForUsage({
      usage: REFERENCE_USAGE,
      pricing: { inPerMTok, outPerMTok, pointsPerUsd },
    });
  }

  const draftEstimate = perkiraan(Number(draft.inPerMTok) || 0, Number(draft.outPerMTok) || 0);

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-2 text-ink">Model AI</h2>
        <Button onClick={bukaBaru} disabled={busy || editingId === ""}>
          Tambah model
        </Button>
      </div>
      <p className="mt-1 max-w-prose text-body text-muted">
        Tarif diisi per model, dan panggilan ditagih dengan tarif baris yang dipakai. Isi tarif{" "}
        <strong className="font-medium text-ink">gateway yang menagih Anda</strong>, bukan harga
        resmi providernya. Selama daftar ini kosong, semua panggilan memakai panel Koneksi AI.
      </p>

      {loading ? (
        <p className="mt-4 text-body text-muted">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-body text-muted">Belum ada model.</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-control px-3.5 py-3 ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-medium text-ink">{row.label}</span>
                    {row.isDefault && <Badge tone="info">Bawaan</Badge>}
                    {!row.active && <Badge tone="neutral">Nonaktif</Badge>}
                    {!row.vision && <Badge tone="warning">Tanpa gambar</Badge>}
                    {row.paidOnly && <Badge tone="emphasis">Paket berbayar</Badge>}
                    {row.apiKeySet && <Badge tone="neutral">Gateway sendiri</Badge>}
                  </div>
                  <p className="mt-0.5 font-mono text-caption text-muted">{row.modelId}</p>
                  <p className="mt-0.5 text-caption text-muted">
                    ${row.inPerMTok} / ${row.outPerMTok} per MTok ·{" "}
                    <span className="tabular-nums">
                      ± {perkiraan(row.inPerMTok, row.outPerMTok).toLocaleString("id-ID")} poin per
                      gambar
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!row.isDefault && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => kirim(`/api/admin/ai-models/${row.id}`, "PATCH", { isDefault: true })}
                      disabled={busy}
                    >
                      Jadikan bawaan
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => bukaSunting(row)} disabled={busy}>
                    Sunting
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => kirim(`/api/admin/ai-models/${row.id}`, "DELETE")}
                    disabled={busy}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingId !== null && (
        <div className="mt-6 grid gap-4 border-t border-border pt-6">
          <Field
            id="model-label"
            label="Nama yang dilihat tenant"
            placeholder="Claude Opus 5"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <Field
            id="model-id"
            label="Model id yang dikirim ke gateway"
            placeholder="claude-opus-5"
            className={ISIAN_MONO}
            value={draft.modelId}
            onChange={(e) => setDraft({ ...draft, modelId: e.target.value })}
          />
          <Field
            id="model-note"
            label="Catatan singkat (opsional)"
            placeholder="Paling teliti untuk gambar rumit"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="model-in"
              label="Tarif input (USD / 1 juta token)"
              inputMode="decimal"
              className={ISIAN_MONO}
              value={draft.inPerMTok}
              onChange={(e) => setDraft({ ...draft, inPerMTok: e.target.value })}
            />
            <Field
              id="model-out"
              label="Tarif output (USD / 1 juta token)"
              inputMode="decimal"
              className={ISIAN_MONO}
              value={draft.outPerMTok}
              onChange={(e) => setDraft({ ...draft, outPerMTok: e.target.value })}
            />
          </div>
          <p className="text-caption text-muted">
            Dengan tarif itu, satu gambar ≈{" "}
            <span className="font-mono tabular-nums">{draftEstimate.toLocaleString("id-ID")}</span>{" "}
            poin.
          </p>

          <Field
            id="model-base-url"
            label="Gateway sendiri (opsional — kosong = gateway global)"
            placeholder="https://api.provider.com/v1"
            className={ISIAN_MONO}
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
          />
          <Field
            id="model-api-key"
            label="Kunci gateway sendiri (kosong = biarkan yang tersimpan)"
            type="password"
            className={ISIAN_MONO}
            value={draft.apiKey}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          />

          <div className="grid gap-2">
            {(
              [
                ["vision", "Bisa membaca gambar (tanpa ini, tidak ditawarkan ke tenant)"],
                ["paidOnly", "Hanya untuk paket berbayar"],
                ["active", "Aktif"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={simpan} disabled={busy}>
              {editingId === "" ? "Simpan model" : "Simpan perubahan"}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-caption text-danger">{error}</p>}
    </Card>
  );
}
