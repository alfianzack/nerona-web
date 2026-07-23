import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserPlanManager } from "@/components/admin/UserPlanManager";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { email: true },
  });
  if (!user) {
    notFound();
  }

  return (
    <div className="max-w-xl">
      <Link href="/admin/users" className="text-sm text-brand-blue hover:underline">
        ‹ Kembali ke daftar pengguna
      </Link>
      <h2 className="mt-3 text-lg font-semibold text-ink">Kelola paket pengguna</h2>
      <div className="mt-4">
        <UserPlanManager userEmail={user.email} />
      </div>
    </div>
  );
}
