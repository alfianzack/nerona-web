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
      {/* Wadah dan <main> tinggal di sini, bukan di tiap halaman: dengan begitu
          semua layar admin berbagi lebar dan irama yang sama tanpa ada yang
          menjahitnya ulang. Napas vertikalnya sekarang ikut token pita (--band)
          yang juga dipakai aplikasi tenant, bukan angka lepas yang kebetulan
          mirip. (Nama kelasnya sengaja tidak ditulis di sini: pemindai Tailwind
          ikut membaca komentar.) */}
      <main className="mx-auto max-w-6xl px-6 py-band">{children}</main>
    </AppShell>
  );
}
