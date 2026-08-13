import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";
import { MARKETING_NAV } from "@/lib/nav";
import { MarketingNavLinks } from "@/components/layout/MarketingNavLinks";

/**
 * Bilah terang, bukan lagi navy pekat.
 *
 * Bar gelap membuat header jadi satu-satunya permukaan gelap yang mengambang
 * di halaman putih: mata berhenti di sana lebih dulu, padahal isinya cuma
 * navigasi. Sekarang bilahnya mundur — kanvas 80% dengan backdrop-blur, dan
 * hanya satu garis rambut yang memisahkannya dari isi halaman, sama seperti
 * kartu di bawahnya.
 *
 * Lebar isinya max-w-band, bukan max-w-5xl, supaya logo dan tautan berdiri
 * tepat di atas tepi kiri-kanan setiap Band di halaman.
 */
export async function MarketingHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-canvas/80 px-6 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-band items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-body font-semibold text-ink">
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
