import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-redirect";
import { AGENT_ENABLED } from "@/lib/features";
import { KONTAK, WA_TAMPIL, waLink } from "@/lib/kontak";

// Hover-nya ke text-ink, bukan ke brand-blue: biru merek mentah gagal uji
// kontras di atas putih, dan footer tidak butuh aksen sama sekali — cukup
// tautan yang menggelap saat disentuh.
const footerLink = "transition hover:text-ink";

// Dengan agent disembunyikan, "/" ADALAH halaman metadata, jadi kedua
// tautan produk itu menunjuk ke tempat yang sama dengan Home.
const FOOTER_LINKS = AGENT_ENABLED
  ? [
      { href: "/", label: "Home" },
      { href: "/agent", label: "Agent" },
      { href: "/metadata", label: "Metadata" },
      { href: "/pricing", label: "Harga" },
    ]
  : [
      { href: "/", label: "Home" },
      { href: "/pricing", label: "Harga" },
    ];

/**
 * Baris kedua, terpisah dari navigasi produk.
 *
 * Dokumen legal tidak dicampur ke deretan yang sama dengan "Home" dan "Harga":
 * keduanya dibaca dengan niat yang berbeda, dan menyelipkannya di antara tautan
 * produk membuatnya justru sulit ditemukan saat dicari.
 */
const LEGAL_LINKS = [
  { href: "/syarat", label: "Syarat & Ketentuan" },
  { href: "/privasi", label: "Kebijakan Privasi" },
];

export async function Footer() {
  const session = await getServerSession(authOptions);

  // The footer now lives only in the (marketing) group, so it no longer has to
  // hide itself when signed in. But signed-in visitors do see it on / and
  // /pricing, where a "Masuk" link is nonsense — point them into the app.
  const links = session?.user
    ? [...FOOTER_LINKS, { href: homeForRole(session.user), label: "Dashboard" }]
    : [...FOOTER_LINKS, { href: "/login", label: "Masuk" }];

  return (
    <footer className="border-t border-border bg-canvas px-6 py-16">
      <div className="mx-auto flex max-w-band flex-col items-center text-center">
        <p className="flex items-center gap-2 text-body font-semibold text-ink">
          <img src="/logo-nerona.svg" alt="" className="h-5 w-5" />
          Nerona
        </p>
        <p className="mt-2 max-w-md text-body text-muted">
          {AGENT_ENABLED
            ? "Alat AI untuk kontributor stock dan pemilik bisnis."
            : "Alat AI untuk kontributor stock."}
        </p>
        <nav className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-caption text-muted">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={footerLink}>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Kontak, dan ini bukan hiasan.
            Nerona menagih lewat transfer manual yang diverifikasi "tim kami".
            Selama tidak ada satu pun cara menghubungi tim itu di seluruh situs,
            yang diminta dari pengunjung bukan pembelian melainkan kepercayaan
            buta — audit halaman menyebutnya penghambat kepercayaan terbesar di
            situs ini. Karena itu ia berdiri di footer, yang muncul di SETIAP
            halaman publik, bukan di satu halaman kontak yang harus dicari. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-caption text-muted">
          <a href={`mailto:${KONTAK.email}`} className={footerLink}>
            {KONTAK.email}
          </a>
          <span aria-hidden="true" className="text-divider">
            ·
          </span>
          <a
            href={waLink(KONTAK.waNomor, "Halo Nerona, saya mau bertanya.")}
            target="_blank"
            rel="noopener noreferrer"
            className={footerLink}
          >
            WhatsApp {WA_TAMPIL}
          </a>
        </div>

        <nav className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-caption text-muted">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={footerLink}>
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="mt-8 text-caption text-muted">
          &copy; {new Date().getFullYear()} {KONTAK.nama}. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
