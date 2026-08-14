import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";
import { pointsForPlan } from "@/lib/plan-points";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";

/**
 * Satu query per permintaan, bukan satu per pemanggil.
 *
 * Repo ini belum punya lapisan cache di mana pun, jadi pembungkusnya ditulis di
 * sini: tanpa itu, halaman yang kelak ikut membaca angka yang sama akan
 * menambah query lagi ke tiap muat halaman auth. cache() milik React berlaku
 * satu permintaan — persis cakupan yang dibutuhkan, dan tidak menyimpan nilai
 * basi setelah owner mengubahnya di Pengaturan.
 */
const freeMetadataPoints = cache(() => pointsForPlan("metadata", "free"));

// No chrome: the auth pages are self-contained cards. A signed-in visitor has
// no business on /login or /register, so send them where they belong.
//
// verify-email and reset-password live here too and are therefore redirected as
// well. That is intended — both flows are entered from an email link while
// signed out.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(homeForRole(session.user));
  }
  // Layar auth memakai permukaan pemasaran, bukan permukaan aplikasi: keduanya
  // dicapai dari header publik dan masih bagian dari corong pendaftaran.
  //
  // Panel merek berdiri sebagai kolom kiri mulai 1024px dan hilang di bawah itu,
  // menyisakan formulir persis seperti sebelumnya. Ia elemen aside, bukan main,
  // supaya AuthShell tetap memegang satu-satunya main di halaman ini.
  const freePoints = await freeMetadataPoints();

  return (
    <div data-surface="marketing" className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <AuthBrandPanel freePoints={freePoints} />
      {children}
    </div>
  );
}
