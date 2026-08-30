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
import { Icon } from "@/components/ui/icons";

/**
 * Field meneruskan `className` ke pembungkusnya, bukan ke isian di dalamnya,
 * jadi mono harus diarahkan langsung ke elemen isiannya. Kalau ditempel di
 * pembungkus, labelnya ikut berubah jadi mono padahal yang perlu hanya isinya:
 * id model dan tarif. Kolom bertipe angka sudah mendapat angka berbaris dari
 * lapisan token, jadi di sini cukup jenis hurufnya.
 */
const ISIAN_MONO = "[&_input]:font-mono";

export function AdminAiSettingsPanel() {
  const [model, setModel] = useState("");
  const [priceIn, setPriceIn] = useState("");
  const [priceOut, setPriceOut] = useState("");
  const [pointsPerUsd, setPointsPerUsd] = useState("");
  const [effective, setEffective] = useState<AiPricing>(DEFAULT_AI_PRICING);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/ai-settings");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat pengaturan AI.");
      return;
    }
    setModel(data.settings.model ?? "");
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
      body: JSON.stringify({ model, priceIn, priceOut, pointsPerUsd }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.message || "Gagal menyimpan pengaturan AI.");
      return;
    }
    setSaved(true);
    load();
  }

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
          <h2 className="text-title-2 text-ink">Bawaan &amp; tarif poin</h2>
          <p className="text-caption text-muted">
            Model bawaan dan kurs poin untuk agen dan extension
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
            setModel(e.target.value);
          }}
          placeholder="gemini-2.0-flash-lite"
          hint="Id model yang dipakai saat daftar Model AI masih kosong. Kuncinya dari provider bawaan."
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
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
        {saved && (
          <Badge tone="success">
            <Icon name="check" className="h-3.5 w-3.5" />
            Tersimpan
          </Badge>
        )}
      </div>
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
