import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";
import { MARKETING_NAV } from "@/lib/nav";
import { MarketingNavLinks } from "@/components/layout/MarketingNavLinks";

export async function MarketingHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-navy-900/10 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"
        >
          <img src="/logo-nerona.svg" alt="" className="h-5 w-5" />
          Nerona
        </Link>
        <MarketingNavLinks
          items={MARKETING_NAV}
          dashboardHref={session?.user ? homeForRole(session.user) : null}
        />
      </div>
    </header>
  );
}
