"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AI_PRICING,
  costForUsage,
  pricingFromInput,
  type AiPricing,
} from "@/lib/agent/pricing";

const inputClass =
  "w-full rounded-xl bg-surface px-3 py-2 text-sm text-ink ring-1 ring-navy-900/[.12] placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

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

  async function handleSave() {
    setError("");
    setSaved(false);
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
    <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-sky/25 text-[#1F7FAE]">
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
          <h2 className="text-lg font-semibold text-ink">Koneksi AI (Sumopod)</h2>
          <p className="text-xs text-muted">Model, API key & tarif poin untuk agen dan extension</p>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="ai-model" className="text-xs font-semibold text-ink">
            Model
          </label>
          <input
            id="ai-model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gemini-2.0-flash-lite"
            className={`mt-1.5 ${inputClass}`}
          />
          <p className="mt-1 text-[11px] text-muted/80">
            Id model persis seperti di Sumopod. Kosongkan untuk pakai default.
          </p>
        </div>
        <div>
          <label htmlFor="ai-key" className="text-xs font-semibold text-ink">
            API key
          </label>
          <input
            id="ai-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyPlaceholder}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        <div className="rounded-xl bg-navy-900/[.03] p-3 ring-1 ring-navy-900/[.06]">
          <p className="text-xs font-semibold text-ink">Tarif poin</p>
          <p className="mt-0.5 text-[11px] text-muted/80">
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
              onChange={setPriceIn}
            />
            <RateField
              id="ai-price-out"
              label="Harga output"
              hint="USD / 1jt token"
              value={priceOut}
              placeholder={String(effective.outPerMTok)}
              onChange={setPriceOut}
            />
            <RateField
              id="ai-points-per-usd"
              label="Poin per USD"
              hint="1 USD = ? poin"
              value={pointsPerUsd}
              placeholder={String(effective.pointsPerUsd)}
              onChange={setPointsPerUsd}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Estimasi: 1.500 token input + 400 token output ≈{" "}
            <span className="font-semibold text-ink">{previewCost} poin</span>
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan koneksi AI"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="rounded-full bg-navy-900/5 px-4 py-2 text-sm font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
        >
          {testing ? "Mengecek..." : "Cek koneksi"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">✓ Tersimpan</span>}
      </div>

      {testResult && <ConnectionTestReport result={testResult} />}
    </div>
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
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 ${inputClass}`}
      />
      <p className="mt-1 text-[10px] text-muted/80">{hint}</p>
    </div>
  );
}

function ProbeRow({ label, probe, hint }: { label: string; probe: Probe; hint: string }) {
  const mark = probe.ok ? "✓" : probe.skipped ? "–" : "✗";
  const tone = probe.ok
    ? "text-emerald-700"
    : probe.skipped
      ? "text-muted"
      : "text-rose-600";
  return (
    <li className="flex gap-2">
      <span className={`font-semibold ${tone}`}>{mark}</span>
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
      <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-500/20">
        API key belum diisi — simpan key dulu, lalu cek lagi.
      </p>
    );
  }

  return (
    <div
      className={`mt-4 rounded-xl px-3 py-3 text-sm ring-1 ${
        result.ok
          ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500/20"
          : "bg-rose-500/10 text-rose-800 ring-rose-500/20"
      }`}
    >
      <p className="font-semibold">
        {result.ok ? "Koneksi AI berfungsi" : "Koneksi AI bermasalah"}
        <span className="ml-1 font-normal opacity-80">({result.model || "model default"})</span>
      </p>
      <ul className="mt-2 space-y-1 text-[13px]">
        <ProbeRow label="Teks" probe={result.text} hint="key valid, model merespons" />
        <ProbeRow label="Gambar" probe={result.vision} hint="model bisa membaca gambar" />
      </ul>
      {result.text.ok && !result.vision.ok && !result.vision.skipped && (
        <p className="mt-2 text-[12px]">
          Key-nya benar, tapi model ini tidak menerima gambar. Semua fitur metadata di
          extension butuh model vision — ganti modelnya.
        </p>
      )}
    </div>
  );
}
