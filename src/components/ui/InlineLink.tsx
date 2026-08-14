import Link from "next/link";
import { cn } from "./cn";

/**
 * Tautan di tengah kalimat.
 *
 * Ada karena TextLink BUKAN ini: TextLink memasang tanda kurung sudut di
 * belakang anaknya, karena ia dibuat untuk aksi kedua sebuah hero yang berdiri
 * sendiri. Dipakai di tengah kalimat, tandanya terbaca seperti salah ketik —
 * "Belum punya akun? Daftar sekarang ›".
 *
 * Pola ini sudah ditulis tangan tiga kali di berkas berbeda sebelum akhirnya
 * jadi komponen. Itu tandanya ia memang komponen.
 */
export function InlineLink({ className, ...rest }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn("font-medium text-accent underline-offset-2 transition hover:underline", className)}
      {...rest}
    />
  );
}
