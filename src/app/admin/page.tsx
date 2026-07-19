import { requireAdmin } from "@/lib/session-guards";
import { AdminUserPanel } from "@/components/admin/AdminUserPanel";
import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";
import { AdminOrdersPanel } from "@/components/admin/AdminOrdersPanel";

export default async function AdminPage() {
  const session = await requireAdmin();

  return (
    <main className="bg-navy-950">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Admin
        </h1>
        <p className="mt-2 text-sm text-navy-300">
          Masuk sebagai {session.user.email} ({session.user.role})
        </p>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <AdminOrdersPanel />
          <AdminUserPanel />
          <AdminPricingPanel />
        </div>
      </div>
    </main>
  );
}
