import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { LicenseSection } from "@/components/account/LicenseSection";
import { ExtensionConnectPanel } from "@/components/account/ExtensionConnectPanel";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordForm } from "@/components/account/PasswordForm";

export const metadata = { title: "Profile — Nerona" };

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailVerified: true,
      name: true,
      phone: true,
      businessName: true,
      password: true,
    },
  });
  const license = await prisma.license.findFirst({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Profile</h1>

        <div className="mt-8 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <p className="text-sm text-muted">Email</p>
          <p className="mt-0.5 font-medium text-ink">{session.user.email}</p>
          <p className="mt-4 text-sm text-muted">Peran</p>
          <p className="mt-0.5 font-medium text-ink">{session.user.role ?? "pelanggan"}</p>
        </div>

        {!user?.emailVerified && (
          <div className="mt-6 rounded-3xl border border-gold-400/30 bg-gold-400/10 p-6">
            <p className="text-sm text-brand-blue">Silakan verifikasi alamat email Anda.</p>
            <div className="mt-2">
              <ResendVerificationButton />
            </div>
          </div>
        )}

        <ProfileForm
          initialName={user?.name ?? ""}
          initialPhone={user?.phone ?? ""}
          initialBusinessName={user?.businessName ?? ""}
        />

        {user?.password && <PasswordForm />}

        {license ? (
          <LicenseSection
            licenseKey={license.licenseKey}
            planName={license.plan?.name ?? "Pro"}
            status={license.status}
            validUntil={license.validUntil ? license.validUntil.toLocaleDateString("id-ID") : null}
          />
        ) : (
          <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 text-center shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
            <p className="text-sm text-muted">Anda belum punya lisensi aktif.</p>
            <Link
              href="/pricing"
              className="mt-3 inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110"
            >
              Lihat harga
            </Link>
          </div>
        )}

        <ExtensionConnectPanel />
      </div>
    </main>
  );
}
