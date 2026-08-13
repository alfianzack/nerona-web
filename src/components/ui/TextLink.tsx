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
export function TextLink({
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link>) {
  return (
    <Link className={cn("text-accent transition hover:underline", className)} {...rest}>
      {children}
      <span aria-hidden="true">&nbsp;&rsaquo;</span>
    </Link>
  );
}
