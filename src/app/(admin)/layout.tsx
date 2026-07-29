import { requireAdmin } from "@/lib/session-guards";
import { ADMIN_NAV } from "@/lib/nav";
import { AppShell } from "@/components/layout/AppShell";

// A sibling of (app), never a child of it: nesting would wrap admin pages in
// the tenant sidebar and the admin sidebar both.
//
// Admins have no personal wallet, so points is null — matching the tenant-only
// rule the old shared Header had.
export default async function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <AppShell
      sections={ADMIN_NAV}
      points={null}
      email={session.user.email ?? ""}
      homeHref="/admin"
    >
      {/* Admin pages bring no <main> and no container of their own. */}
      <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
    </AppShell>
  );
}
