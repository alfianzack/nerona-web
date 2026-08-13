/**
 * Penggabung className.
 *
 * Enam baris, bukan dependensi baru. Proyek ini tidak memakai clsx maupun
 * tailwind-merge, dan menambahkannya hanya untuk ini tidak sepadan — tidak ada
 * primitive di sini yang perlu menyelesaikan konflik kelas Tailwind, karena
 * override selalu datang lewat satu prop `className` di urutan terakhir.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
