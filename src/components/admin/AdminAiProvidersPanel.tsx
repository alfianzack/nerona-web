"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/icons";

/**
 * Field meneruskan `className` ke pembungkusnya, bukan ke isian di dalamnya,
 * jadi mono harus diarahkan langsung ke elemen isiannya.
 */
const ISIAN_MONO = "[&_input]:font-mono";

interface ProviderRow {
  id: string;
  label: string;
  baseUrl: string;
  isDefault: boolean;
  sortOrder: number;
  apiKeyMasked: string;
  apiKeySet: boolean;
  createdAt: string;
  updatedAt: string;
}

const KOSONG = { label: "", baseUrl: "", apiKey: "" };

type Draft = typeof KOSONG;

interface Probe {
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

interface ConnectionTestResult {
  ok: boolean;
  configured: boolean;
  model: string;
  text: Probe;
  vision: Probe;
}

export function AdminAiProvidersPanel() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(KOSONG);
  /** Label & baseUrl baris yang dimuat dari server, untuk mendeteksi draft yang belum disimpan. */
  const [stored, setStored] = useState({ label: "", baseUrl: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [testModel, setTestModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  async function muat() {
    setLoading(true);
    const res = await fetch("/api/admin/ai-providers");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat daftar provider.");
    } else {
      setRows(data.providers);
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
    setTestModel("");
    setTestResult(null);
    setError("");
  }

  function bukaSunting(row: ProviderRow) {
    setEditingId(row.id);
    setDraft({
      label: row.label,
      baseUrl: row.baseUrl,
      // Sengaja kosong: kunci tidak pernah dikirim balik utuh, jadi kosong di
      // sini berarti "biarkan yang tersimpan", bukan "hapus".
      apiKey: "",
    });
    setStored({ label: row.label, baseUrl: row.baseUrl });
    setTestModel("");
    setTestResult(null);
    setError("");
  }

  /**
   * "Cek" menguji konfigurasi yang TERSIMPAN di server, bukan draft di layar —
   * ia tidak mengirim label/baseUrl/apiKey, server yang membaca baris
   * providernya. Owner yang menempel kunci baru lalu langsung klik Cek akan
   * mendapat vonis tentang kunci LAMA sementara formulir menampilkan yang
   * baru. Blokir dulu selama drafnya belum disimpan.
   */
  const hasUnsavedConnectionEdits =
    draft.label !== stored.label || draft.baseUrl !== stored.baseUrl || draft.apiKey !== "";

  async function simpan() {
    const payload = {
      label: draft.label,
      baseUrl: draft.baseUrl,
      ...(draft.apiKey.trim() ? { apiKey: draft.apiKey } : {}),
    };
    const ok =
      editingId === ""
        ? await kirim("/api/admin/ai-providers", "POST", payload)
        : await kirim(`/api/admin/ai-providers/${editingId}`, "PATCH", payload);
    if (ok) setEditingId(null);
  }

  async function handleTest() {
    if (!editingId) return;
    setError("");
    setTestResult(null);
    setTesting(true);
    const res = await fetch(`/api/admin/ai-providers/${editingId}/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: testModel }),
    });
    const data = await res.json().catch(() => null);
    setTesting(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal menjalankan pengecekan koneksi.");
      return;
    }
    setTestResult(data.result);
  }

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-2 text-ink">Provider AI</h2>
        <Button onClick={bukaBaru} disabled={busy || editingId === ""}>
          Tambah provider
        </Button>
      </div>
      <p className="mt-1 max-w-prose text-body text-muted">
        Satu provider menyimpan satu kunci gateway, dipakai bersama oleh semua model yang
        menunjuknya.
      </p>

      {loading ? (
        <p className="mt-4 text-body text-muted">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-body text-muted">Belum ada provider.</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-control px-3.5 py-3 ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-medium text-ink">{row.label}</span>
                    {row.isDefault && <Badge tone="info">Bawaan</Badge>}
                  </div>
                  <p className="mt-0.5 font-mono text-caption text-muted">{row.baseUrl}</p>
                  <p className="mt-0.5 font-mono text-caption text-muted">
                    {row.apiKeySet ? row.apiKeyMasked : "belum ada kunci — pakai SUMOPOD_API_KEY"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!row.isDefault && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => kirim(`/api/admin/ai-providers/${row.id}`, "PATCH", { isDefault: true })}
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
                    onClick={() => kirim(`/api/admin/ai-providers/${row.id}`, "DELETE")}
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
            id="provider-label"
            label="Nama"
            placeholder="SumoPod"
            value={draft.label}
            onChange={(e) => {
              setTestResult(null);
              setDraft({ ...draft, label: e.target.value });
            }}
          />
          <Field
            id="provider-base-url"
            label="Base URL"
            placeholder="https://api.provider.com/v1"
            className={ISIAN_MONO}
            value={draft.baseUrl}
            onChange={(e) => {
              setTestResult(null);
              setDraft({ ...draft, baseUrl: e.target.value });
            }}
          />
          <Field
            id="provider-api-key"
            label="API key"
            type="password"
            className={ISIAN_MONO}
            value={draft.apiKey}
            onChange={(e) => {
              setTestResult(null);
              setDraft({ ...draft, apiKey: e.target.value });
            }}
            hint="Kosongkan untuk tetap memakai kunci yang tersimpan"
          />

          <div className="flex items-center gap-2">
            <Button onClick={simpan} disabled={busy}>
              {editingId === "" ? "Simpan provider" : "Simpan perubahan"}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
              Batal
            </Button>
          </div>

          {/* Menguji butuh id yang sudah tersimpan di server, jadi provider baru
              yang belum disimpan tidak punya blok ini. */}
          {editingId !== "" && (
            <div className="grid gap-2 border-t border-border pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field
                  id="provider-test-model"
                  label="Model id untuk diuji"
                  placeholder="gemini-2.0-flash-lite"
                  className={`flex-1 ${ISIAN_MONO}`}
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={handleTest}
                  disabled={testing || !testModel.trim() || hasUnsavedConnectionEdits}
                  title={
                    hasUnsavedConnectionEdits
                      ? "Simpan dulu — pengecekan menguji pengaturan yang tersimpan."
                      : undefined
                  }
                >
                  {testing ? "Mengecek..." : "Cek"}
                </Button>
              </div>
              {hasUnsavedConnectionEdits && (
                <span className="text-caption text-muted">
                  Simpan dulu — pengecekan menguji pengaturan yang tersimpan.
                </span>
              )}
              {testResult && <ConnectionTestReport result={testResult} />}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-caption text-danger">{error}</p>}
    </Card>
  );
}

function ProbeRow({ label, probe, hint }: { label: string; probe: Probe; hint: string }) {
  /**
   * Penanda hasil dulu glyph teks. Glyph teks tidak bisa disetel ukurannya,
   * tingginya berbeda antar huruf, dan ✓ serta ✗ tidak sama beratnya — jadi dua
   * baris yang sejajar terlihat tidak sejajar.
   *
   * "Tidak dijalankan" belum punya glyph netral di daftar Icon; jam dipakai
   * karena artinya memang "belum jalan", bukan gagal.
   */
  const icon: IconName = probe.ok ? "check-circle" : probe.skipped ? "clock" : "close";
  const tone = probe.ok ? "text-success" : probe.skipped ? "text-muted" : "text-danger";
  return (
    <li className="flex gap-2">
      <Icon name={icon} className={`mt-0.5 h-4 w-4 flex-none ${tone}`} />
      <span className="min-w-0">
        <span className="font-medium text-ink">{label}</span>{" "}
        <span className="text-muted">— {probe.ok ? hint : probe.skipped ? "tidak dijalankan" : probe.error}</span>
      </span>
    </li>
  );
}

function ConnectionTestReport({ result }: { result: ConnectionTestResult }) {
  if (!result.configured) {
    return (
      <p className="mt-4 rounded-card bg-warning-bg px-3 py-2 text-body text-warning ring-1 ring-warning/25">
        API key belum diisi — simpan key dulu, lalu cek lagi.
      </p>
    );
  }

  return (
    <div
      className={`mt-4 rounded-card px-3 py-3 text-body ring-1 ${
        result.ok ? "bg-success-bg ring-success/25" : "bg-danger-bg ring-danger/25"
      }`}
    >
      <p className={`font-semibold ${result.ok ? "text-success" : "text-danger"}`}>
        {result.ok ? "Koneksi AI berfungsi" : "Koneksi AI bermasalah"}
        {/* Nama model mono: ia disalin bulat-bulat dari dashboard Sumopod, dan
            satu huruf meleset berarti kesimpulan di atasnya tentang model lain. */}
        <span className="ml-1 font-mono text-caption font-normal text-muted">
          ({result.model || "model default"})
        </span>
      </p>
      <ul className="mt-2 space-y-1">
        <ProbeRow label="Teks" probe={result.text} hint="key valid, model merespons" />
        <ProbeRow label="Gambar" probe={result.vision} hint="model bisa membaca gambar" />
      </ul>
      {result.text.ok && !result.vision.ok && !result.vision.skipped && (
        <p className="mt-2 text-caption text-ink">
          Key-nya benar, tapi model ini tidak menerima gambar. Semua fitur metadata di
          extension butuh model vision — ganti modelnya.
        </p>
      )}
    </div>
  );
}
