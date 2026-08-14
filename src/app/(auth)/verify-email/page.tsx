import { verifyEmailToken } from "@/lib/verify-email";
import { AuthShell } from "@/components/auth/AuthShell";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { InlineLink } from "@/components/ui/InlineLink";
import { Icon } from "@/components/ui/icons";

/**
 * Satu-satunya layar auth tanpa formulir: hasilnya sudah ditentukan di server
 * sebelum halaman dirender. Memakai kerangka yang sama dengan empat layar lain,
 * jadi logo, posisi kartu, dan jaraknya identik.
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

  if (result.ok) {
    return (
      <AuthShell title="Email terverifikasi">
        <div className="text-center">
          <Icon name="check-circle" className="mx-auto h-10 w-10 text-success" />
          <p className="mt-4 text-body text-muted">Alamat email Anda sudah terverifikasi.</p>
          {/* Satu-satunya jalan keluar dari halaman ini, jadi ia berhak jadi
              aksi utama. */}
          <div className="mt-8">
            <ButtonLink href="/account" full>
              Buka halaman akun
            </ButtonLink>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Tautan kedaluwarsa"
      footer={
        <>
          Sudah punya akun? <InlineLink href="/login">Masuk</InlineLink>
        </>
      }
    >
      <div className="text-center">
        <Icon name="close" className="mx-auto h-10 w-10 text-danger" />
        <p className="mt-4 text-body text-muted">
          Tautan verifikasi ini tidak valid atau sudah kedaluwarsa. Masuk ke akun Anda untuk
          meminta tautan baru.
        </p>
        <div className="mt-8">
          <ButtonLink href="/account" full>
            Buka halaman akun
          </ButtonLink>
        </div>
      </div>
    </AuthShell>
  );
}
