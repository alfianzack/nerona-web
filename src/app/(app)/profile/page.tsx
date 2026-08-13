import { requireUser } from "@/lib/session-guards";
import { prisma } from "@/lib/prisma";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { ProfileForm } from "@/components/account/ProfileForm";
import { PasswordForm } from "@/components/account/PasswordForm";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

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
  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-band">
        <PageHeader title="Profile" />

        <div className="mt-8 space-y-6">
          {/*
            Dua keterangan yang tidak bisa diubah dari sini, jadi bentuknya
            daftar definisi — bukan formulir tanpa isian. Emailnya memakai mono
            karena ia identitas akun: yang dibaca huruf per huruf saat mencocokkan
            dengan yang tertulis di tempat lain.
          */}
          <Card>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-mono text-label uppercase text-muted">Email</dt>
                <dd className="mt-1 break-all font-mono text-body text-ink">
                  {session.user.email}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-label uppercase text-muted">Peran</dt>
                <dd className="mt-1 text-body text-ink">{session.user.role ?? "pelanggan"}</dd>
              </div>
            </dl>
          </Card>

          {!user?.emailVerified && (
            <div className="rounded-card bg-warning-bg p-5 ring-1 ring-warning/25">
              <p className="text-body text-ink">Silakan verifikasi alamat email Anda.</p>
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

          {/*
            Kartu lisensi dan panel extension pindah ke /unduh — tempat orang
            benar-benar memakainya. Tautan ini bukan hiasan: siapa pun yang
            terbiasa mencari extension-nya di halaman ini akan menyimpulkan
            fiturnya dihapus kalau tidak ada penunjuk arah.
          */}
          <Card>
            <h2 className="text-title-2 text-ink">Lisensi &amp; perangkat</h2>
            <p className="mt-2 text-body text-muted">
              Kunci lisensi, unduhan extension &amp; Nerona Hub, dan daftar perangkat yang
              tersambung sekarang ada di satu halaman.
            </p>
            <ButtonLink href="/unduh" variant="secondary" className="mt-4">
              Buka Unduh &amp; Pasang
            </ButtonLink>
          </Card>
        </div>
      </div>
    </main>
  );
}
