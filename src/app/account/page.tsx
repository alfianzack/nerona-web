import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { LicenseSection } from "@/components/account/LicenseSection";

export default async function AccountPage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  const license = await prisma.license.findFirst({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p className="mt-4">Email: {session.user.email}</p>
      <p>Role: {session.user.role ?? "customer"}</p>
      {!user?.emailVerified && (
        <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please verify your email address.
          </p>
          <div className="mt-2">
            <ResendVerificationButton />
          </div>
        </div>
      )}
      {license ? (
        <LicenseSection
          licenseKey={license.licenseKey}
          planName={license.plan?.name ?? "Pro"}
          status={license.status}
          validUntil={license.validUntil ? license.validUntil.toDateString() : null}
        />
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          You don&apos;t have an active license yet.{" "}
          <a href="/pricing" className="font-medium text-gray-900 underline dark:text-white">
            Subscribe
          </a>
        </p>
      )}
    </main>
  );
}
