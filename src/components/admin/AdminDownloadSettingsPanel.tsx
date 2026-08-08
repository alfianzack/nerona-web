"use client";

import { useEffect, useState } from "react";
import { tautanAman, UNDUHAN_KOSONG, type UnduhanSettings } from "@/lib/unduhan";

const inputClass =
  "w-full rounded-xl bg-surface px-3 py-2 text-sm text-ink ring-1 ring-navy-900/[.12] placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

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
    return (
      <div
        key={field.key}
        className={
          field.bahaya ? "rounded-xl bg-rose-500/[0.06] p-3 ring-1 ring-rose-500/25" : undefined
        }
      >
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={`unduh-${field.key}`} className="text-xs font-semibold text-ink">
            {field.label}
          </label>
          {field.url &&
            (aman ? (
              <a
                href={aman}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[11px] font-semibold text-[#1F7FAE] underline underline-offset-2"
              >
                Uji ↗
              </a>
            ) : (
              <span className="text-[11px] text-muted/70">
                {values[field.key].trim() ? "bukan URL https" : "kosong"}
              </span>
            ))}
        </div>
        <input
          id={`unduh-${field.key}`}
          type="text"
          value={values[field.key]}
          onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
          placeholder={field.placeholder}
          className={`mt-1.5 ${inputClass}`}
        />
        {field.help && (
          <p className={`mt-1 text-[11px] ${field.bahaya ? "text-rose-700" : "text-muted/80"}`}>
            {field.help}
          </p>
        )}
      </div>
    );
  }

  const manual = FIELDS.filter((f) => !f.otomatis);
  const otomatis = FIELDS.filter((f) => f.otomatis);

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
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">Tautan unduhan</h2>
          <p className="text-xs text-muted">Aset rilis di nerona-hub-releases</p>
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-navy-900/[0.03] p-3 text-[11px] text-muted ring-1 ring-navy-900/10">
        Kolom URL dan versi <b>diisi sendiri oleh CI</b> setiap kali tag <code>hub-v*</code>{" "}
        atau <code>ext-v*</code> diterbitkan, jadi biasanya tidak ada yang perlu disentuh di
        sini.
      </p>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      <div className="mt-4 space-y-4">{manual.map(renderKolom)}</div>

      <details className="mt-4 rounded-xl bg-navy-900/[0.03] ring-1 ring-navy-900/10">
        <summary className="cursor-pointer p-3 text-[11px] font-semibold text-muted">
          Kolom yang diisi CI — buka hanya untuk menambal keadaan darurat
        </summary>
        <div className="px-3 pb-3">
          <p className="mb-3 text-[11px] text-muted/80">
            Suntingan di sini <b>akan tertimpa</b> pada rilis berikutnya. Kolom kosong membuat
            tombolnya di <code>/unduh</code> mati dan bertuliskan &quot;Belum tersedia&quot;.
            Setelah menempel URL dengan tangan, klik <b>Uji</b> — tidak ada pemeriksaan lain
            yang bisa menangkap salah ketik.
          </p>
          <div className="space-y-4">{otomatis.map(renderKolom)}</div>
        </div>
      </details>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan tautan"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">✓ Tersimpan</span>}
      </div>
    </div>
  );
}
