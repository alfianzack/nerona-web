import Link from "next/link";
import { verifyEmailToken } from "@/lib/verify-email";

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
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-surface to-surface2 p-8 text-center shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        {result.ok ? (
          <>
            <h1 className="text-2xl font-semibold text-ink">
              Email terverifikasi
            </h1>
            <p className="mt-2 text-sm text-muted">
              Alamat email Anda sudah terverifikasi.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-ink">
              Tautan kedaluwarsa
            </h1>
            <p className="mt-2 text-sm text-muted">
              Tautan verifikasi ini tidak valid atau sudah kedaluwarsa.
            </p>
          </>
        )}
        <Link
          href="/account"
          className="mt-6 inline-block font-medium text-brand-blue underline"
        >
          Buka halaman akun
        </Link>
      </div>
    </main>
  );
}
