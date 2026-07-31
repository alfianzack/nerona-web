import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";
import { MARKETING_NAV } from "@/lib/nav";
import { MarketingNavLinks } from "@/components/layout/MarketingNavLinks";

export async function MarketingHeader() {
  const session = await getServerSession(authOptions);

  return (
    /* Bar gelap #16233d — dipakai lewat nama token `navy-900` (hex yang sama,
       dan sama dengan `ink`) supaya warnanya tetap punya satu sumber.
       Semua isi bar ikut dibalik ke terang; teks `text-ink` di sini hilang total.

       SOLID, bukan `/90` + backdrop-blur seperti bar terang sebelumnya: dengan
       opasitas 90% di atas kanvas terang, warna nyatanya jadi ±#2C3850 — bukan
       #16233d. Bar buram juga membuat blur tidak ada gunanya, jadi ikut dilepas. */
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-900">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white"
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
