import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { getUnduhanSettings } from "@/lib/unduhan-settings";
import { tautanAman } from "@/lib/unduhan";
import { LicenseSection } from "@/components/account/LicenseSection";
import { ExtensionConnectPanel } from "@/components/account/ExtensionConnectPanel";
import { KartuHub } from "@/components/unduh/KartuHub";

export const metadata = { title: "Unduh & Pasang — Nerona" };

export default async function UnduhPage() {
  const session = await requireUser();
  const [license, settings] = await Promise.all([
    prisma.license.findFirst({
      where: { userId: session.user.id },
      include: { plan: true },
    }),
    getUnduhanSettings(),
  ]);

  // Semua URL lewat `tautanAman` DI SINI, satu kali, sebelum menyentuh `href`.
  // Nilainya diketik admin, jadi ini titik tempat "boleh jadi tautan" ditentukan.
  const urlExtension = tautanAman(settings.extensionUrl);
  const urlWindows = tautanAman(settings.hubWindowsUrl);
  const urlMac = tautanAman(settings.hubMacUrl);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Unduh &amp; Pasang
        </h1>
        <p className="mt-3 text-sm text-muted">
          Dua alat, satu akun. <b>Extension Nerona Metadata</b> membuat judul dan keyword
          langsung di halaman kontributor marketplace. <b>Nerona Hub</b> aplikasi desktop yang
          mengunggah folder JPEG beserta metadatanya ke banyak marketplace sekaligus.
        </p>

        {license ? (
          <LicenseSection
            licenseKey={license.licenseKey}
            planName={license.plan?.name ?? "Pro"}
            status={license.status}
            validUntil={license.validUntil ? license.validUntil.toLocaleDateString("id-ID") : null}
          />
        ) : (
          <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 text-center shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
            <p className="text-sm text-muted">
              Anda belum punya lisensi aktif. Kedua alat di bawah tetap boleh diunduh dan
              disambungkan, tapi belum bisa dipakai membuat metadata.
            </p>
            <Link
              href="/pricing"
              className="mt-3 inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
            >
              Lihat harga
            </Link>
          </div>
        )}

        {/*
          Panel ini yang memegang seluruh alur extension: deteksi terpasang,
          tombol unduh, langkah pasang, penyambungan, dan daftar perangkat.
          Ia dipindah dari /profile apa adanya — hanya menerima dua prop baru.
        */}
        <ExtensionConnectPanel unduhUrl={urlExtension} versiTerbaru={settings.extensionVersion} />

        <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <h2 className="text-lg font-semibold text-ink">Nerona Hub</h2>
          <p className="mt-1 text-sm text-muted">
            Pilih folder JPEG, metadatanya dibuat otomatis, lalu dikirim ke marketplace lewat
            FTP. Butuh akun Nerona yang sama dengan extension.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <KartuHub os="windows" url={urlWindows} versi={settings.hubVersion} />
            <KartuHub os="mac" url={urlMac} versi={settings.hubVersion} />
          </div>

          <div className="mt-5 rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10">
            <p className="text-sm font-semibold text-ink">Menyambungkan Hub ke akun ini</p>
            <ol className="mt-1 list-inside list-decimal space-y-1 text-xs text-muted">
              <li>
                Buka Nerona Hub, masuk ke layar <b>Akun</b>, klik <b>Hubungkan akun</b>.
              </li>
              <li>
                Browser akan terbuka ke halaman persetujuan dengan kodenya sudah terisi.
                Cocokkan kode itu dengan yang tampil di layar Hub, lalu klik <b>Setujui</b>.
              </li>
              <li>
                Layar Hub berubah sendiri dalam beberapa detik. Kode hanya berlaku 10 menit —
                kalau kedaluwarsa, klik Hubungkan akun lagi untuk kode baru.
              </li>
            </ol>
            <p className="mt-2 text-[11px] text-muted/80">
              Tidak perlu menyalin token apa pun. Kalau halaman persetujuannya tidak bisa
              dibuka, ada jalan keluar token manual di bagian &quot;Kalau tombolnya tidak
              muncul&quot; pada panel extension di atas.
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted">
          Perangkat yang tersambung bisa diputuskan kapan saja dari daftar di panel extension di
          atas — memutuskan mencabut aksesnya ke akun ini, tanpa menghapus aplikasinya.
        </p>
      </div>
    </main>
  );
}
