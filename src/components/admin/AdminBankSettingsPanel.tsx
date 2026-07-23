"use client";

import { useEffect, useState } from "react";

interface BankSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
}

const EMPTY: BankSettings = { bankName: "", accountNumber: "", accountHolder: "", instructions: "" };

const inputClass =
  "w-full rounded-xl bg-surface px-3 py-2 text-sm text-ink ring-1 ring-navy-900/[.12] placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

const FIELDS: {
  key: keyof BankSettings;
  label: string;
  placeholder: string;
  textarea?: boolean;
  help?: string;
}[] = [
  { key: "bankName", label: "Nama bank", placeholder: "mis. BCA" },
  { key: "accountNumber", label: "Nomor rekening", placeholder: "mis. 1234567890" },
  { key: "accountHolder", label: "Atas nama", placeholder: "mis. PT Nerona" },
  {
    key: "instructions",
    label: "Catatan (opsional)",
    placeholder: "mis. transfer sesuai nominal tepat",
    textarea: true,
    help: "Muncul di bawah detail rekening pada halaman order.",
  },
];

export function AdminBankSettingsPanel() {
  const [values, setValues] = useState<BankSettings>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/payment-settings");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat rekening pembayaran.");
      return;
    }
    setValues({ ...EMPTY, ...data.settings });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    const res = await fetch("/api/admin/payment-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Gagal menyimpan rekening.");
      return;
    }
    setSaved(true);
  }

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
            <line x1="3" y1="22" x2="21" y2="22" />
            <line x1="6" y1="18" x2="6" y2="11" />
            <line x1="10" y1="18" x2="10" y2="11" />
            <line x1="14" y1="18" x2="14" y2="11" />
            <line x1="18" y1="18" x2="18" y2="11" />
            <polygon points="12 2 20 7 4 7" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">Rekening transfer</h2>
          <p className="text-xs text-muted">Ditampilkan ke pelanggan saat checkout</p>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      <div className="mt-4 space-y-4">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label htmlFor={`bank-${field.key}`} className="text-xs font-semibold text-ink">
              {field.label}
            </label>
            {field.textarea ? (
              <textarea
                id={`bank-${field.key}`}
                rows={2}
                value={values[field.key]}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className={`mt-1.5 ${inputClass}`}
              />
            ) : (
              <input
                id={`bank-${field.key}`}
                type="text"
                value={values[field.key]}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className={`mt-1.5 ${inputClass} ${
                  field.key === "accountNumber" ? "tabular-nums" : ""
                }`}
              />
            )}
            {field.help && <p className="mt-1 text-[11px] text-muted/80">{field.help}</p>}
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan rekening"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">✓ Tersimpan</span>}
      </div>
    </div>
  );
}
