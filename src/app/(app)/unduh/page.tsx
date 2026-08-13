import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { getUnduhanSettings } from "@/lib/unduhan-settings";
import { tautanAman } from "@/lib/unduhan";
import { LicenseSection } from "@/components/account/LicenseSection";
import { ExtensionConnectPanel } from "@/components/account/ExtensionConnectPanel";
import { KartuHub } from "@/components/unduh/KartuHub";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <div className="mx-auto max-w-3xl px-6 py-band">
        {/* Deskripsinya tidak masuk ke prop PageHeader karena mengandung
            penebalan; propnya hanya menerima teks polos. */}
        <PageHeader title="Unduh & Pasang" />
        <p className="mt-2 max-w-[62ch] text-body text-muted">
          Dua alat, satu akun. <b>Extension Nerona Metadata</b> membuat judul dan keyword
          langsung di halaman kontributor marketplace. <b>Nerona Hub</b> aplikasi desktop yang
          mengunggah folder JPEG beserta metadatanya ke banyak marketplace sekaligus.
        </p>

        <div className="mt-8 space-y-6">
          {license ? (
            <LicenseSection
              licenseKey={license.licenseKey}
              planName={license.plan?.name ?? "Pro"}
              status={license.status}
              validUntil={
                license.validUntil ? license.validUntil.toLocaleDateString("id-ID") : null
              }
            />
          ) : (
            <Card className="text-center">
              <p className="text-body text-muted">
                Anda belum punya lisensi aktif. Kedua alat di bawah tetap boleh diunduh dan
                disambungkan, tapi belum bisa dipakai membuat metadata.
              </p>
              {/* Satu-satunya jalan keluar dari kartu ini adalah membeli paket,
                  jadi tombolnya bernada uang. */}
              <ButtonLink href="/pricing" variant="money" className="mt-4">
                Lihat harga
              </ButtonLink>
            </Card>
          )}

          {/*
            Panel ini yang memegang seluruh alur extension: deteksi terpasang,
            tombol unduh, langkah pasang, penyambungan, dan daftar perangkat.
            Ia dipindah dari /profile apa adanya — hanya menerima dua prop baru.
          */}
          <ExtensionConnectPanel unduhUrl={urlExtension} versiTerbaru={settings.extensionVersion} />

          <Card>
            <h2 className="text-title-2 text-ink">Nerona Hub</h2>
            <p className="mt-2 text-body text-muted">
              Pilih folder JPEG, metadatanya dibuat otomatis, lalu dikirim ke marketplace lewat
              FTP. Butuh akun Nerona yang sama dengan extension.
            </p>

            {/*
              Ditampilkan untuk yang belum berhak, dan unduhannya TIDAK diblokir:
              memblokir berkas yang toh tidak berguna tanpa akun cuma menambah
              satu cara gagal tanpa menambah satu pun perlindungan. Penjaganya di
              server — `approvePairing` menolak menyambungkan Hub ke lisensi tanpa
              bendera `hub`.
            */}
            {!license?.hub && (
              <div className="mt-4 rounded-card bg-warning-bg p-4 ring-1 ring-warning/25">
                <p className="text-body text-ink">Nerona Hub tersedia di paket Business.</p>
                <p className="mt-1.5 text-caption text-muted">
                  Anda tetap bisa mengunduh dan memasangnya, tapi penyambungan akun akan ditolak
                  sampai paketnya Business.{" "}
                  {/* Tautan di tengah kalimat, jadi tautan biasa — TextLink
                      memasang kurung sudut yang hanya benar di akhir baris. */}
                  <Link href="/pricing" className="font-semibold text-accent underline">
                    Lihat harga
                  </Link>
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <KartuHub os="windows" url={urlWindows} versi={settings.hubVersion} />
              <KartuHub os="mac" url={urlMac} versi={settings.hubVersion} />
            </div>

            <Card variant="sunken" padding="sm" className="mt-5">
              <h3 className="text-body font-semibold text-ink">Menyambungkan Hub ke akun ini</h3>
              <ol className="mt-1.5 list-inside list-decimal space-y-1 text-caption text-muted">
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
              <p className="mt-3 text-caption text-muted">
                Tidak perlu menyalin token apa pun. Kalau halaman persetujuannya tidak bisa
                dibuka, ada jalan keluar token manual di bagian &quot;Kalau tombolnya tidak
                muncul&quot; pada panel extension di atas.
              </p>
            </Card>
          </Card>
        </div>

        <p className="mt-6 text-caption text-muted">
          Perangkat yang tersambung bisa diputuskan kapan saja dari daftar di panel extension di
          atas — memutuskan mencabut aksesnya ke akun ini, tanpa menghapus aplikasinya.
        </p>
      </div>
    </main>
  );
}
