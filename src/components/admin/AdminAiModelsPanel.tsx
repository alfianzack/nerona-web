"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
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
  providerId: string;
  sortOrder: number;
}

const KOSONG = {
  label: "",
  modelId: "",
  note: "",
  inPerMTok: "",
  outPerMTok: "",
  providerId: "",
  vision: true,
  paidOnly: false,
  active: true,
};

type Draft = typeof KOSONG;

/** Profil token acuan yang sama dengan lib/ai-models.ts. */
const REFERENCE_USAGE = { promptTokens: 1_200, completionTokens: 150 };

export interface AiModelsPanelData {
  models: ModelRow[];
  providers: Array<{ id: string; label: string; isDefault: boolean }>;
  /** Undefined kalau setelan poin gagal dimuat — bukan alasan menganggap panel gagal. */
  pointsPerUsd?: number;
}

/**
 * Model dan provider dianggap satu paket, keduanya wajib berhasil. Provider
 * yang gagal dimuat dulu diam-diam menjadi daftar kosong, dan itu terbaca di
 * layar sebagai kehilangan data padahal cuma satu fetch yang sempat gagal:
 * setiap baris model menampilkan badge "Provider terhapus" walau providernya
 * baik-baik saja, dan formulir Sunting menampilkan "— pilih provider —"
 * untuk baris yang sebetulnya sudah punya provider.
 *
 * Setelan poin (untuk estimasi biaya) sengaja tidak ikut jadi syarat: kalau
 * itu saja yang gagal, panel tetap terpakai dengan angka poin bawaan.
 */
export async function loadAiModelsPanelData(): Promise<AiModelsPanelData | null> {
  const [modelsRes, aiRes, providersRes] = await Promise.all([
    fetch("/api/admin/ai-models"),
    fetch("/api/admin/ai-settings"),
    fetch("/api/admin/ai-providers"),
  ]);
  const models = await modelsRes.json().catch(() => null);
  const ai = await aiRes.json().catch(() => null);
  const providersData = await providersRes.json().catch(() => null);
  if (!modelsRes.ok || !models?.ok || !providersRes.ok || !providersData?.ok) {
    return null;
  }
  return {
    models: models.models,
    providers: providersData.providers,
    pointsPerUsd: ai?.ok ? ai.settings.effective.pointsPerUsd : undefined,
  };
}

export function AdminAiModelsPanel() {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [providers, setProviders] = useState<Array<{ id: string; label: string; isDefault: boolean }>>([]);
  const [pointsPerUsd, setPointsPerUsd] = useState(1_000);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(KOSONG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** Galat milik daftar: gagal memuat, gagal menghapus, gagal memindah bawaan. */
  const [error, setError] = useState("");
  /**
   * Galat milik formulir, dirender DI DALAM modal.
   *
   * Kalau ia ikut ke `error` di kaki kartu, ia muncul di belakang tirai modal —
   * tidak terlihat sama sekali, dan owner hanya melihat tombol Simpan yang
   * seolah tidak melakukan apa-apa.
   */
  const [formError, setFormError] = useState("");

  async function muat() {
    setLoading(true);
    const data = await loadAiModelsPanelData();
    if (!data) {
      setError("Gagal memuat daftar model.");
    } else {
      setRows(data.models);
      if (data.pointsPerUsd !== undefined) setPointsPerUsd(data.pointsPerUsd);
      setProviders(data.providers);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    void muat();
  }, []);

  /**
   * Mengembalikan pesannya, tidak memasangnya sendiri: pemanggilnya yang tahu
   * galat ini milik daftar atau milik formulir, dan keduanya tampil di tempat
   * berbeda sejak formulirnya melayang.
   */
  async function kirim(
    url: string,
    method: string,
    body?: unknown
  ): Promise<{ ok: boolean; message: string }> {
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data?.ok) {
      return { ok: false, message: data?.message || "Gagal menyimpan." };
    }
    await muat();
    return { ok: true, message: "" };
  }

  /** Aksi pada baris daftar — galatnya milik daftar, jadi tampil di kaki kartu. */
  async function aksiBaris(url: string, method: string, body?: unknown) {
    setError("");
    const hasil = await kirim(url, method, body);
    if (!hasil.ok) setError(hasil.message);
  }

  function tutup() {
    setEditingId(null);
    setFormError("");
  }

  function bukaBaru() {
    setEditingId("");
    // Pilihan awal yang masuk akal — provider bawaan kalau ada, kalau tidak
    // provider pertama — bukan kolom kosong yang pasti ditolak server.
    setDraft({ ...KOSONG, providerId: providers.find((p) => p.isDefault)?.id ?? providers[0]?.id ?? "" });
    setFormError("");
  }

  function bukaSunting(row: ModelRow) {
    setEditingId(row.id);
    setDraft({
      label: row.label,
      modelId: row.modelId,
      note: row.note || "",
      inPerMTok: String(row.inPerMTok),
      outPerMTok: String(row.outPerMTok),
      providerId: row.providerId,
      vision: row.vision,
      paidOnly: row.paidOnly,
      active: row.active,
    });
    setFormError("");
  }

  async function simpan() {
    const payload = {
      label: draft.label,
      modelId: draft.modelId,
      note: draft.note,
      inPerMTok: draft.inPerMTok,
      outPerMTok: draft.outPerMTok,
      providerId: draft.providerId,
      vision: draft.vision,
      paidOnly: draft.paidOnly,
      active: draft.active,
    };
    setFormError("");
    const hasil =
      editingId === ""
        ? await kirim("/api/admin/ai-models", "POST", payload)
        : await kirim(`/api/admin/ai-models/${editingId}`, "PATCH", payload);
    if (hasil.ok) tutup();
    else setFormError(hasil.message);
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
                    <Badge tone="neutral">
                      {providers.find((p) => p.id === row.providerId)?.label ?? "Provider terhapus"}
                    </Badge>
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
                      onClick={() => aksiBaris(`/api/admin/ai-models/${row.id}`, "PATCH", { isDefault: true })}
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
                    onClick={() => aksiBaris(`/api/admin/ai-models/${row.id}`, "DELETE")}
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

      <Modal
        open={editingId !== null}
        onClose={tutup}
        title={editingId === "" ? "Tambah model" : "Sunting model"}
      >
        <div className="grid gap-4">
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

          <label className="grid gap-1.5">
            <span className="text-label text-ink">Provider</span>
            <select
              className="rounded-control px-3 py-2 text-body text-ink ring-1 ring-border"
              value={draft.providerId}
              onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}
            >
              <option value="">— pilih provider —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="text-caption text-muted">
              Kunci dan alamat gateway diambil dari provider ini, tidak diisi lagi di sini.
            </span>
          </label>

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

          {formError && <p className="text-caption text-danger">{formError}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={simpan} disabled={busy}>
              {editingId === "" ? "Simpan model" : "Simpan perubahan"}
            </Button>
            <Button variant="ghost" onClick={tutup} disabled={busy}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>

      {error && <p className="mt-4 text-caption text-danger">{error}</p>}
    </Card>
  );
}
