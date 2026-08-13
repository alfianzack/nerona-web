import { ButtonLink } from "@/components/ui/ButtonLink";

interface CtaLinkProps {
  href: string;
  tone?: "onDark" | "onLight";
  children: React.ReactNode;
}

/**
 * Ajakan pemasaran yang sama, dipakai di atas kanvas terang dan di dalam pita
 * navy.
 *
 * Berkas ini yang terakhir memakai biru bawaan Tailwind — dua langkah warna
 * yang tidak ada di palet mana pun — dan di jalur terangnya isian biru itu
 * dipasangkan dengan teks `ink`: gelap di atas gelap, nyaris tidak terbaca.
 * Sekarang bentuk, ukuran, dan jejak fokusnya diserahkan ke ButtonLink,
 * sehingga sama persis dengan tombol utama di halaman yang sama.
 *
 * Nama kelas lamanya sengaja tidak ditulis di komentar ini: pemindai Tailwind
 * membaca komentar juga, dan akan menghidupkan kembali kelas yang baru dibuang.
 *
 * `onDark` memakai variant secondary, bukan warna khusus: di dalam pita navy,
 * `bg-surface` tetap putih dan `text-ink` tetap navy gelap, jadi variant itu
 * memang sudah pil putih berteks gelap. `primary` justru tidak bisa dipakai di
 * sana — token `--action` adalah warna yang sedang jadi latar.
 */
export function CtaLink({ href, tone = "onLight", children }: CtaLinkProps) {
  return (
    <ButtonLink href={href} variant={tone === "onDark" ? "secondary" : "primary"} size="lg">
      {children}
    </ButtonLink>
  );
}
