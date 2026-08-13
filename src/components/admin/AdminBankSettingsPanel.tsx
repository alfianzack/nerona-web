"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";

interface BankSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
}

const EMPTY: BankSettings = { bankName: "", accountNumber: "", accountHolder: "", instructions: "" };

/**
 * Field meneruskan `className` ke pembungkusnya, bukan ke isian di dalamnya,
 * jadi mono harus diarahkan langsung ke elemen isiannya. Kalau ditempel di
 * pembungkus, labelnya ikut berubah jadi mono padahal hanya angkanya yang perlu.
 */
const ISIAN_ANGKA = "[&_input]:font-mono [&_input]:tabular-nums";

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
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-chip bg-brand-sky/25 text-brand-sky-ink">
          <Icon name="bank" />
        </span>
        <div>
          <h2 className="text-title-2 text-ink">Rekening transfer</h2>
          <p className="text-caption text-muted">Ditampilkan ke pelanggan saat checkout</p>
        </div>
      </div>

      {error && <p className="mt-2 text-body text-danger">{error}</p>}
      <div className="mt-4 space-y-4">
        {FIELDS.map((field) =>
          field.textarea ? (
            // Belum ada primitif untuk area teks bertingkat, jadi label, cincin,
            // dan warna fokusnya sengaja dicocokkan dengan Field supaya kolom
            // catatan tidak terlihat berasal dari formulir lain.
            <div key={field.key} className="grid gap-1.5">
              <label
                htmlFor={`bank-${field.key}`}
                className="text-caption font-medium text-muted"
              >
                {field.label}
              </label>
              <textarea
                id={`bank-${field.key}`}
                rows={2}
                value={values[field.key]}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                aria-describedby={field.help ? `bank-${field.key}-hint` : undefined}
                className="w-full rounded-control bg-surface px-3.5 py-2.5 text-body text-ink ring-1 ring-border transition placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {field.help && (
                <p id={`bank-${field.key}-hint`} className="text-caption text-muted">
                  {field.help}
                </p>
              )}
            </div>
          ) : (
            <Field
              key={field.key}
              id={`bank-${field.key}`}
              label={field.label}
              type="text"
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              hint={field.help}
              // Nomor rekening disalin orang ke aplikasi banknya digit demi
              // digit, jadi lebarnya harus tetap dan angkanya tidak boleh bisa
              // salah dibaca.
              className={field.key === "accountNumber" ? ISIAN_ANGKA : undefined}
            />
          ),
        )}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan rekening"}
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
