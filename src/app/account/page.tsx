import Link from "next/link";
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
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: { course: { select: { slug: true, title: true } } },
  });

  return (
    <main className="bg-navy-950">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Akun Anda
        </h1>

        <div className="mt-8 rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-6 shadow-lg shadow-black/40 ring-1 ring-white/10">
          <p className="text-sm text-navy-300">Email</p>
          <p className="mt-0.5 font-medium text-white">{session.user.email}</p>
          <p className="mt-4 text-sm text-navy-300">Peran</p>
          <p className="mt-0.5 font-medium text-white">
            {session.user.role ?? "pelanggan"}
          </p>
        </div>

        {!user?.emailVerified && (
          <div className="mt-6 rounded-3xl border border-gold-400/30 bg-gold-400/10 p-6">
            <p className="text-sm text-gold-300">
              Silakan verifikasi alamat email Anda.
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
            validUntil={license.validUntil ? license.validUntil.toLocaleDateString("id-ID") : null}
          />
        ) : (
          <div className="mt-6 rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-6 text-center shadow-lg shadow-black/40 ring-1 ring-white/10">
            <p className="text-sm text-navy-300">
              Anda belum punya lisensi aktif.
            </p>
            <Link
              href="/pricing"
              className="mt-3 inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
            >
              Lihat harga
            </Link>
          </div>
        )}

        {enrollments.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Kelas Anda
            </h2>
            <div className="mt-4 space-y-3">
              {enrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/learn/${enrollment.course.slug}`}
                  className="flex items-center justify-between rounded-2xl bg-gradient-to-b from-navy-800 to-navy-900 p-5 text-sm font-medium text-white shadow-lg shadow-black/40 ring-1 ring-white/10 transition hover:brightness-110"
                >
                  {enrollment.course.title}
                  <span aria-hidden="true" className="text-navy-300/70">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
