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
    <main className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 p-8 text-center shadow-xl dark:border-gray-800">
        {result.ok ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Email verified
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your email address has been verified.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Link expired
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              This verification link is invalid or has expired.
            </p>
          </>
        )}
        <Link
          href="/account"
          className="mt-6 inline-block font-medium text-gray-900 underline dark:text-white"
        >
          Go to your account
        </Link>
      </div>
    </main>
  );
}
