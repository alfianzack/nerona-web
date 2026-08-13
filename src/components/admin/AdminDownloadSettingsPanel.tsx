"use client";

import { useEffect, useState } from "react";
import { tautanAman, UNDUHAN_KOSONG, type UnduhanSettings } from "@/lib/unduhan";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";

/**
 * Field meneruskan `className` ke pembungkusnya, bukan ke isian di dalamnya,
 * jadi mono harus diarahkan langsung ke elemen isiannya. Kalau ditempel di
 * pembungkus, labelnya ikut berubah jadi mono padahal yang perlu hanya URL-nya.
 *
 * Isian tetap selebar kartunya dan menggulir sendiri ke samping saat URL-nya
 * lebih panjang — itulah sebabnya URL panjang tidak pernah memaksa kolom ini
 * melebar.
 */
const ISIAN_MONO = "[&_input]:font-mono";

type Kolom = {
  key: keyof UnduhanSettings;
  label: string;
  placeholder: string;
  /** Kolom URL dapat tautan "Uji"; kolom versi tidak. */
  url?: boolean;
  help?: string;
  /** Kolom yang mengunci pengguna dari pekerjaannya. Dibingkai merah. */
  bahaya?: boolean;
  /**
   * Diisi CI tiap rilis. Kolom begini disembunyikan di balik pengungkap
   * tertutup: menyuntingnya bukan pekerjaan rutin, dan yang disunting akan
   * tertimpa pada tag berikutnya.
   */
  otomatis?: boolean;
};

const FIELDS: Kolom[] = [
  {
    key: "extensionMinVersion",
    label: "Versi extension minimum",
    placeholder: "biarkan kosong",
    bahaya: true,
    help: "Kosong = tidak ada yang diblokir. Begitu diisi, setiap extension yang lebih tua — termasuk semua salinan yang terbit sebelum fitur ini ada — berhenti bisa generate sampai dipasang ulang. Isi hanya saat ada perubahan yang benar-benar memutus kompatibilitas.",
  },
  {
    key: "extensionUrl",
    label: "URL ZIP extension",
    placeholder: "https://github.com/.../releases/download/ext-v1.1.2/nerona-metadata-1.1.2.zip",
    url: true,
    otomatis: true,
  },
  {
    key: "extensionVersion",
    label: "Versi extension",
    placeholder: "mis. 1.1.2",
    otomatis: true,
    help: "Dibandingkan dengan versi yang benar-benar terpasang di browser pengguna. Lebih tua = extension menyalakan badge dan halaman unduh menyuruh mereka memperbarui.",
  },
  {
    key: "hubWindowsUrl",
    label: "URL installer Windows (.msi)",
    placeholder: "https://github.com/.../releases/download/hub-v0.1.2/Nerona.Hub_0.1.2_x64_en-US.msi",
    url: true,
    otomatis: true,
  },
  {
    key: "hubMacUrl",
    label: "URL installer macOS (.dmg)",
    placeholder: "https://github.com/.../releases/download/hub-v0.1.2/Nerona.Hub_0.1.2_universal.dmg",
    url: true,
    otomatis: true,
  },
  {
    key: "hubVersion",
    label: "Versi Nerona Hub",
    placeholder: "mis. 0.1.2",
    otomatis: true,
    help: "Kosongkan kalau tidak ingin nomor versi tampil di kartu unduh.",
  },
];

/**
 * Tautan unduhan hidup di `Setting` supaya rilis baru tidak menuntut deploy
 * ulang. Sejak CI mengisinya sendiri tiap tag, panel ini bukan lagi langkah
 * rutin — ia penambal keadaan darurat.
 *
 * Sengaja TIDAK dihapus: ia satu-satunya jalan memundurkan versi atau menambal
 * URL kalau suatu saat CI menerbitkan yang salah. Tanpa itu, satu-satunya
 * pemulihan adalah menunggu rilis berikutnya.
 *
 * Tidak ada tes yang bisa membuktikan URL eksternal hidup, jadi tombol "Uji" di
 * tiap kolom adalah satu-satunya penjaga yang mungkin — dan ia hanya bekerja
 * kalau benar-benar diklik.
 */
export function AdminDownloadSettingsPanel() {
  const [values, setValues] = useState<UnduhanSettings>(UNDUHAN_KOSONG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/download-settings");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError("Gagal memuat tautan unduhan.");
      return;
    }
    setValues({ ...UNDUHAN_KOSONG, ...data.settings });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    const res = await fetch("/api/admin/download-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Gagal menyimpan tautan unduhan.");
      return;
    }
    setSaved(true);
  }

  function renderKolom(field: Kolom) {
    const aman = field.url ? tautanAman(values[field.key]) : null;
    const bahayaId = `unduh-${field.key}-bahaya`;
    return (
      <div
        key={field.key}
        className={
          field.bahaya ? "rounded-card bg-danger-bg p-4 ring-1 ring-danger/25" : undefined
        }
      >
        {/*
          Petunjuk kolom berbahaya tidak dilewatkan sebagai `hint` — petunjuk
          Field selalu tenang, dan yang ini harus merah. Ia juga tidak boleh
          dilewatkan sebagai `error`: itu akan menyalakan `aria-invalid` dan
          memberi tahu pembaca layar bahwa isiannya salah, padahal kosong justru
          keadaan yang benar. Jadi ia dicetak sendiri dan disambungkan balik
          lewat `aria-describedby`.
        */}
        <Field
          id={`unduh-${field.key}`}
          label={field.label}
          type="text"
          value={values[field.key]}
          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
          placeholder={field.placeholder}
          hint={field.bahaya ? undefined : field.help}
          aria-describedby={field.bahaya && field.help ? bahayaId : undefined}
          className={field.url ? ISIAN_MONO : undefined}
        />
        {field.bahaya && field.help && (
          <p id={bahayaId} className="mt-1.5 text-caption text-danger">
            {field.help}
          </p>
        )}
        {/* "Uji" turun ke bawah isian karena baris label kini milik Field.
            Tempatnya justru jadi lebih benar: ia menguji apa yang barusan
            ditempel, tepat di bawah tempat menempelkannya. */}
        {field.url && (
          <div className="mt-1.5 flex justify-end">
            {aman ? (
              <a
                href={aman}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-caption font-medium text-accent underline underline-offset-2"
              >
                Uji
                <Icon name="external-link" className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-caption text-muted">
                {values[field.key].trim() ? "bukan URL https" : "kosong"}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  const manual = FIELDS.filter((f) => !f.otomatis);
  const otomatis = FIELDS.filter((f) => f.otomatis);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-chip bg-brand-sky/25 text-brand-sky-ink">
          <Icon name="download" />
        </span>
        <div>
          <h2 className="text-title-2 text-ink">Tautan unduhan</h2>
          <p className="text-caption text-muted">Aset rilis di nerona-hub-releases</p>
        </div>
      </div>

      <Card variant="sunken" padding="sm" className="mt-3 text-caption text-muted">
        Kolom URL dan versi <b>diisi sendiri oleh CI</b> setiap kali tag <code>hub-v*</code>{" "}
        atau <code>ext-v*</code> diterbitkan, jadi biasanya tidak ada yang perlu disentuh di
        sini.
      </Card>

      {error && <p className="mt-2 text-body text-danger">{error}</p>}

      <div className="mt-4 space-y-4">{manual.map(renderKolom)}</div>

      <details className="mt-4 rounded-card bg-surface-sunken ring-1 ring-border">
        <summary className="cursor-pointer p-3 text-caption font-medium text-muted">
          Kolom yang diisi CI — buka hanya untuk menambal keadaan darurat
        </summary>
        <div className="px-3 pb-3">
          <p className="mb-3 text-caption text-muted">
            Suntingan di sini <b>akan tertimpa</b> pada rilis berikutnya. Kolom kosong membuat
            tombolnya di <code>/unduh</code> mati dan bertuliskan &quot;Belum tersedia&quot;.
            Setelah menempel URL dengan tangan, klik <b>Uji</b> — tidak ada pemeriksaan lain
            yang bisa menangkap salah ketik.
          </p>
          <div className="space-y-4">{otomatis.map(renderKolom)}</div>
        </div>
      </details>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan tautan"}
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
