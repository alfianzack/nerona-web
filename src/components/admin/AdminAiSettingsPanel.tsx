"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AI_PRICING,
  costForUsage,
  pricingFromInput,
  type AiPricing,
} from "@/lib/agent/pricing";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/icons";

/**
 * Field meneruskan `className` ke pembungkusnya, bukan ke isian di dalamnya,
 * jadi mono harus diarahkan langsung ke elemen isiannya. Kalau ditempel di
 * pembungkus, labelnya ikut berubah jadi mono padahal yang perlu hanya isinya:
 * id model, kunci API, dan tarif. Kolom bertipe angka sudah mendapat angka
 * berbaris dari lapisan token, jadi di sini cukup jenis hurufnya.
 */
const ISIAN_MONO = "[&_input]:font-mono";

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

export function AdminAiSettingsPanel() {
  const [model, setModel] = useState("");
  /** Last value loaded from the server, so unsaved edits are detectable. */
  const [storedModel, setStoredModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [priceIn, setPriceIn] = useState("");
  const [priceOut, setPriceOut] = useState("");
  const [pointsPerUsd, setPointsPerUsd] = useState("");
  const [effective, setEffective] = useState<AiPricing>(DEFAULT_AI_PRICING);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  async function load() {
    const res = await fetch("/api/admin/ai-settings");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat pengaturan AI.");
      return;
    }
    setModel(data.settings.model ?? "");
    setStoredModel(data.settings.model ?? "");
    setApiKeyMasked(data.settings.apiKeyMasked ?? "");
    setApiKeySet(Boolean(data.settings.apiKeySet));
    setPriceIn(data.settings.priceIn ?? "");
    setPriceOut(data.settings.priceOut ?? "");
    setPointsPerUsd(data.settings.pointsPerUsd ?? "");
    setEffective(data.settings.effective ?? DEFAULT_AI_PRICING);
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * A connection verdict only describes the model and key it ran against, so it
   * has to die the moment either of those changes. Without this a green
   * "berfungsi (gpt-5-nano)" panel survives a switch to another model and reads
   * as if the new one had been verified.
   *
   * Point rates do not affect the probe, so they deliberately do not clear it.
   */
  function invalidateTestResult() {
    setTestResult(null);
  }

  async function handleSave() {
    setError("");
    setSaved(false);
    // The stored config is about to change; whatever is on screen described the
    // previous one.
    invalidateTestResult();
    setSaving(true);
    const res = await fetch("/api/admin/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, apiKey, priceIn, priceOut, pointsPerUsd }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.message || "Gagal menyimpan pengaturan AI.");
      return;
    }
    setSaved(true);
    setApiKey("");
    load();
  }

  async function handleTest() {
    setError("");
    setTestResult(null);
    setTesting(true);
    const res = await fetch("/api/admin/ai-settings/test", { method: "POST" });
    const data = await res.json().catch(() => null);
    setTesting(false);

    if (res.status === 429) {
      setError("Terlalu sering. Tunggu sebentar sebelum cek lagi.");
      return;
    }
    if (!res.ok || !data?.ok) {
      setError("Gagal menjalankan pengecekan koneksi.");
      return;
    }
    setTestResult(data.result);
  }

  /**
   * "Cek koneksi" probes the SAVED settings — it posts no body, so the server
   * reads the Setting rows. Running it against unsaved edits produces a verdict
   * about the old model while the form shows a new one, which is exactly the
   * confusion this panel used to cause. Block it instead.
   */
  const hasUnsavedConnectionEdits = model !== storedModel || apiKey !== "";

  const keyPlaceholder = apiKeySet
    ? `Tersimpan (${apiKeyMasked}) — biarkan kosong untuk tetap`
    : "Tempel API key Sumopod";

  // Preview at the values being typed, falling back to what is in force right now.
  const previewPricing = pricingFromInput({ priceIn, priceOut, pointsPerUsd }, effective);
  const previewCost = costForUsage({
    usage: { promptTokens: 1500, completionTokens: 400 },
    pricing: previewPricing,
  });

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-chip bg-brand-sky/25 text-brand-sky-ink">
          {/* Daftar Icon belum punya glyph otak, jadi gambarnya tetap di sini.
              Warnanya tidak ditulis di SVG-nya sendiri, melainkan diwarisi dari
              warna teks induknya, supaya ia ikut token seperti ikon lain. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
          >
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z" />
          </svg>
        </span>
        <div>
          <h2 className="text-title-2 text-ink">Koneksi AI (Sumopod)</h2>
          <p className="text-caption text-muted">
            Model, API key & tarif poin untuk agen dan extension
          </p>
        </div>
      </div>

      {error && <p className="mt-2 text-body text-danger">{error}</p>}

      <div className="mt-4 space-y-4">
        <Field
          id="ai-model"
          label="Model"
          type="text"
          value={model}
          onChange={(e) => {
            setSaved(false);
            invalidateTestResult();
            setModel(e.target.value);
          }}
          placeholder="gemini-2.0-flash-lite"
          hint="Id model persis seperti di Sumopod. Kosongkan untuk pakai default."
          className={ISIAN_MONO}
        />
        <Field
          id="ai-key"
          label="API key"
          type="password"
          value={apiKey}
          onChange={(e) => {
            setSaved(false);
            invalidateTestResult();
            setApiKey(e.target.value);
          }}
          placeholder={keyPlaceholder}
          className={ISIAN_MONO}
        />

        <Card variant="sunken" padding="sm">
          <p className="font-mono text-label uppercase text-muted">Tarif poin</p>
          <p className="mt-1 text-caption text-muted">
            Dipakai untuk menghitung poin yang dipotong tiap panggilan AI (agen &
            extension). Kosongkan untuk pakai default.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RateField
              id="ai-price-in"
              label="Harga input"
              hint="USD / 1jt token"
              value={priceIn}
              placeholder={String(effective.inPerMTok)}
              onChange={(v) => {
                setSaved(false);
                setPriceIn(v);
              }}
            />
            <RateField
              id="ai-price-out"
              label="Harga output"
              hint="USD / 1jt token"
              value={priceOut}
              placeholder={String(effective.outPerMTok)}
              onChange={(v) => {
                setSaved(false);
                setPriceOut(v);
              }}
            />
            <RateField
              id="ai-points-per-usd"
              label="Poin per USD"
              hint="1 USD = ? poin"
              value={pointsPerUsd}
              placeholder={String(effective.pointsPerUsd)}
              onChange={(v) => {
                setSaved(false);
                setPointsPerUsd(v);
              }}
            />
          </div>
          <p className="mt-3 text-caption text-muted">
            Estimasi: <span className="font-mono tabular-nums">1.500</span> token input +{" "}
            <span className="font-mono tabular-nums">400</span> token output ≈{" "}
            <span className="font-mono font-semibold tabular-nums text-ink">
              {previewCost} poin
            </span>
          </p>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan koneksi AI"}
        </Button>
        {/* Mengecek koneksi tidak mengubah apa pun, jadi ia aksi kedua di baris
            ini — bukan tombol yang sama menonjolnya dengan Simpan. */}
        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={testing || hasUnsavedConnectionEdits}
          title={
            hasUnsavedConnectionEdits
              ? "Simpan dulu — pengecekan menguji pengaturan yang tersimpan."
              : undefined
          }
        >
          {testing ? "Mengecek..." : "Cek koneksi"}
        </Button>
        {saved && (
          <Badge tone="success">
            <Icon name="check" className="h-3.5 w-3.5" />
            Tersimpan
          </Badge>
        )}
        {hasUnsavedConnectionEdits && (
          <span className="text-caption text-muted">
            Simpan dulu untuk bisa cek koneksi — pengecekan memakai pengaturan yang tersimpan.
          </span>
        )}
      </div>

      {testResult && <ConnectionTestReport result={testResult} />}
    </Card>
  );
}

function RateField({
  id,
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      type="number"
      min="0"
      step="any"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={ISIAN_MONO}
    />
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
