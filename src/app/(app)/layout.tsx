import { requireUser } from "@/lib/session-guards";
import { getBalance } from "@/lib/points";
import { TENANT_NAV } from "@/lib/nav";
import { AppShell } from "@/components/layout/AppShell";

// The per-page requireUser() calls stay: they need the session object for data
// fetching, and this guard is defense in depth, mirroring how middleware.ts
// already duplicates the admin check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const points = await getBalance(session.user.id);

  return (
    <AppShell
      sections={TENANT_NAV}
      points={points}
      email={session.user.email ?? ""}
      homeHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
