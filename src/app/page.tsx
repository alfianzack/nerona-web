import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Nerona Metadata</h1>
      {session?.user ? (
        <div className="mt-4 space-y-2">
          <p>Signed in as {session.user.email}</p>
          <p>
            <Link href="/account" className="text-blue-600 underline">
              Go to your account
            </Link>
          </p>
          <p>
            <a href="/api/auth/signout" className="text-blue-600 underline">
              Sign out
            </a>
          </p>
        </div>
      ) : (
        <p className="mt-4">
          <a href="/login" className="text-blue-600 underline">
            Sign in
          </a>
        </p>
      )}
    </main>
  );
}
