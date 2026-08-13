import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/button-styles";

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
    <Card variant="sunken">
      <div className="min-w-0">
        <h3 className="text-title-2 text-ink">{JUDUL[os]}</h3>
        <p className="mt-1 text-caption text-muted">
          {BERKAS[os]}
          {versi ? (
            <>
              {" · versi "}
              <span className="font-mono tabular-nums">{versi}</span>
            </>
          ) : (
            ""
          )}
        </p>
      </div>
      <div className="mt-4 flex justify-center">
        {url ? (
          // Mengunduh installer tidak memindahkan uang, jadi tombolnya setingkat
          // aksi utama biasa. Emas disimpan untuk beli, top-up, dan perpanjang.
          <a href={url} download className={buttonClass({ variant: "primary" })}>
            Download Nerona Hub
          </a>
        ) : (
          /*
            Bukan tombol yang dinonaktifkan: elemen disabled tidak memunculkan
            tooltip `title` di Chrome, dan kalimat itulah satu-satunya yang
            menjelaskan bahwa yang kosong adalah pengaturan admin, bukan rilisnya.
          */
          <span
            className="inline-flex cursor-not-allowed items-center justify-center whitespace-nowrap rounded-action bg-surface px-4 py-2 text-body font-medium text-muted ring-1 ring-border"
            title="Tautan unduhan belum diisi di pengaturan admin."
          >
            Belum tersedia
          </span>
        )}
      </div>
      <ol className="mt-4 list-inside list-decimal space-y-1.5 text-caption text-muted">
        {LANGKAH[os]}
      </ol>
    </Card>
  );
}
