import type { ReactNode } from "react";

interface KartuHubProps {
  os: "windows" | "mac";
  /** URL aset installer, sudah lewat `tautanAman`. `null` = belum diisi di admin. */
  url: string | null;
  versi: string;
}

const JUDUL: Record<KartuHubProps["os"], string> = {
  windows: "Windows",
  mac: "macOS",
};

const BERKAS: Record<KartuHubProps["os"], string> = {
  windows: "Installer .msi · 64-bit",
  mac: "Installer .dmg · Intel & Apple Silicon",
};

/**
 * Langkah pasang per sistem operasi.
 *
 * Peringatan SmartScreen/Gatekeeper WAJIB ada dan tidak boleh diperhalus:
 * kedua installer tidak ditandatangani CA (keputusan owner — rilis dulu, beli
 * sertifikat nanti), jadi setiap pengguna baru PASTI melihat layar yang
 * berkata aplikasinya tidak dikenal atau berbahaya. Pengguna yang tidak
 * diberi tahu lebih dulu akan berhenti di situ, dan tidak ada apa pun di sisi
 * kita yang menunjukkan itu terjadi.
 */
const LANGKAH: Record<KartuHubProps["os"], ReactNode> = {
  windows: (
    <>
      <li>Jalankan berkas .msi yang terunduh.</li>
      <li>
        Windows akan menampilkan <b>&quot;Windows protected your PC&quot;</b> (SmartScreen). Itu
        muncul karena installernya belum ditandatangani sertifikat berbayar, bukan karena
        berkasnya bermasalah. Klik <b>More info</b> → <b>Run anyway</b>.
      </li>
      <li>Ikuti wizard sampai selesai, lalu buka Nerona Hub dari Start Menu.</li>
    </>
  ),
  mac: (
    <>
      <li>
        Buka berkas .dmg, lalu tarik <b>Nerona Hub</b> ke folder <b>Applications</b>.
      </li>
      <li>
        Jangan klik dua kali saat pertama membuka — macOS akan menolaknya dengan
        &quot;cannot be opened because the developer cannot be verified&quot;. <b>Klik kanan</b>{" "}
        ikonnya → <b>Open</b> → <b>Open</b> lagi di dialog berikutnya.
      </li>
      <li>
        Kalau tetap tertolak: <b>System Settings</b> → <b>Privacy &amp; Security</b>, gulir ke
        bawah, klik <b>Open Anyway</b>.
      </li>
      <li>
        Saat pertama menyimpan kredensial marketplace, macOS meminta izin{" "}
        <b>Keychain</b> — pilih <b>Always Allow</b> supaya tidak ditanya setiap unggahan.
      </li>
    </>
  ),
};

export function KartuHub({ os, url, versi }: KartuHubProps) {
  return (
    <div className="rounded-3xl bg-navy-900/[0.03] p-5 ring-1 ring-navy-900/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{JUDUL[os]}</p>
          <p className="mt-0.5 text-xs text-muted">
            {BERKAS[os]}
            {versi ? ` · versi ${versi}` : ""}
          </p>
        </div>
        {url ? (
          <a
            href={url}
            download
            className="whitespace-nowrap rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
          >
            Unduh
          </a>
        ) : (
          <span
            className="cursor-not-allowed whitespace-nowrap rounded-full bg-navy-900/5 px-4 py-2 text-sm font-semibold text-muted ring-1 ring-navy-900/10"
            title="Tautan unduhan belum diisi di pengaturan admin."
          >
            Belum tersedia
          </span>
        )}
      </div>
      <ol className="mt-4 list-inside list-decimal space-y-1.5 text-xs text-muted">
        {LANGKAH[os]}
      </ol>
    </div>
  );
}
