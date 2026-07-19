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
    <main className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-navy-800 to-navy-900 p-8 text-center shadow-lg shadow-black/40 ring-1 ring-white/10">
        {result.ok ? (
          <>
            <h1 className="text-2xl font-semibold text-white">
              Email terverifikasi
            </h1>
            <p className="mt-2 text-sm text-navy-300">
              Alamat email Anda sudah terverifikasi.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-white">
              Tautan kedaluwarsa
            </h1>
            <p className="mt-2 text-sm text-navy-300">
              Tautan verifikasi ini tidak valid atau sudah kedaluwarsa.
            </p>
          </>
        )}
        <Link
          href="/account"
          className="mt-6 inline-block font-medium text-gold-400 underline"
        >
          Buka halaman akun
        </Link>
      </div>
    </main>
  );
}
