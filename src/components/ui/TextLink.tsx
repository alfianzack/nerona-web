import Link from "next/link";
import { cn } from "./cn";

/**
 * Aksi kedua di halaman publik.
 *
 * Hero sekarang memasang dua pil berdampingan, yang membuat keduanya terlihat
 * sama penting dan tidak satu pun menonjol. Aksi kedua turun jadi tautan teks
 * dengan kurung sudut — pola yang sama dipakai apple.com, dan efeknya satu pil
 * di layar itu akhirnya benar-benar terbaca sebagai satu ajakan.
 */
type TextLinkTone = "default" | "on-navy";

/**
 * Nada disediakan sebagai prop, bukan ditimpa dari luar lewat className.
 *
 * Menimpanya dari luar memang "bekerja" di sini, tapi hanya karena nama kelas
 * penggantinya kebetulan jatuh setelah nama kelas bawaannya menurut abjad —
 * dan abjad itulah yang menentukan pemenang di CSS keluaran, bukan urutan
 * penulisan di className. Satu nama kelas berubah, dan tautan di atas navy
 * diam-diam kembali biru gelap tanpa ada yang menandai.
 */
const TONES: Record<TextLinkTone, string> = {
  default: "text-accent",
  "on-navy": "text-navy-100 hover:text-white",
};

export function TextLink({
  tone = "default",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { tone?: TextLinkTone }) {
  return (
    <Link className={cn("transition hover:underline", TONES[tone], className)} {...rest}>
      {children}
      <span aria-hidden="true">&nbsp;&rsaquo;</span>
    </Link>
  );
}
