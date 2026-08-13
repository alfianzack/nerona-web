import { verifyEmailToken } from "@/lib/verify-email";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";

/**
 * Satu-satunya layar auth tanpa formulir: hasilnya sudah ditentukan di server
 * sebelum halaman dirender. Kerangka kartunya tetap ditulis sama persis seperti
 * tiga layar auth lain supaya kartunya duduk di tempat yang sama — termasuk
 * `flex-1`, bukan tinggi layar kedua, karena layout grup (auth) sudah memegang
 * tinggi layarnya.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  const result = token
    ? await verifyEmailToken(token)
    : ({ ok: false, error: "invalid_or_expired" } as const);

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card padding="lg" className="w-full max-w-sm text-center">
        {result.ok ? (
          <>
            <h1 className="text-title-1 text-ink">Email terverifikasi</h1>
            <p className="mt-2 text-body text-muted">
              Alamat email Anda sudah terverifikasi.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-title-1 text-ink">Tautan kedaluwarsa</h1>
            <p className="mt-2 text-body text-muted">
              Tautan verifikasi ini tidak valid atau sudah kedaluwarsa.
            </p>
          </>
        )}
        {/* Satu-satunya jalan keluar dari halaman ini, jadi ia berhak jadi aksi
            utama. Sebelumnya sebuah tautan `text-brand-blue` — biru merek mentah
            yang gagal kontras di atas putih. */}
        <div className="mt-8">
          <ButtonLink href="/account">Buka halaman akun</ButtonLink>
        </div>
      </Card>
    </main>
  );
}
