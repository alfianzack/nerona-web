import { requireAdmin } from "@/lib/session-guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Admin</h1>
          <p className="text-xs text-muted">
            {session.user.email} · {session.user.role}
          </p>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
