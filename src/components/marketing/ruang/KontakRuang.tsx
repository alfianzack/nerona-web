import Link from "next/link";
import { KONTAK, WA_TAMPIL, waLink } from "@/lib/kontak";

/**
 * Kontak dan tautan legal di lapisan penutup Ruang Kata.
 *
 * Menggantikan peran Footer di beranda (yang tidak lagi dirender di sana).
 * Datanya dari lib/kontak, sumber yang sama dengan Footer halaman lain: tidak
 * ada nomor atau alamat yang ditulis ulang di sini. Alasan kontak wajib ada
 * tercatat di docblock Footer: Nerona menagih lewat transfer yang diverifikasi
 * "tim kami", dan tanpa cara menghubungi tim itu yang diminta dari pengunjung
 * adalah kepercayaan buta.
 */
const LEGAL = [
  { href: "/syarat", label: "Syarat & Ketentuan" },
  { href: "/privasi", label: "Kebijakan Privasi" },
];

const tautan = "transition hover:text-ink";

export function KontakRuang() {
  return (
    <div className="mx-auto mt-12 flex max-w-[64ch] flex-col items-center gap-3 text-caption text-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <a href={`mailto:${KONTAK.email}`} className={tautan}>
          {KONTAK.email}
        </a>
        <span aria-hidden="true" className="text-divider">
          ·
        </span>
        <a
          href={waLink(KONTAK.waNomor, "Halo Nerona, saya mau bertanya.")}
          target="_blank"
          rel="noopener noreferrer"
          className={tautan}
        >
          WhatsApp {WA_TAMPIL}
        </a>
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {LEGAL.map((l) => (
          <Link key={l.href} href={l.href} className={tautan}>
            {l.label}
          </Link>
        ))}
        <span aria-hidden="true" className="text-divider">
          ·
        </span>
        <span>© {new Date().getFullYear()} Nerona</span>
      </p>
    </div>
  );
}
