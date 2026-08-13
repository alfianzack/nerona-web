import { cn } from "./cn";

/**
 * Memakai `--radius-control`, bukan `--radius-action`.
 *
 * Halaman publik memberi tombol bentuk pil 980px; isian tidak pernah ikut.
 * Kotak teks berbentuk pil menyulitkan mata menemukan awal barisnya, dan tidak
 * ada satu pun formulir apple.com yang melakukannya.
 */
export function Input({
  invalid,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-control bg-surface px-3.5 py-2.5 text-body text-ink transition",
        "ring-1 ring-border placeholder:text-muted/60",
        "focus:outline-none focus:ring-2 focus:ring-accent",
        invalid && "ring-2 ring-danger focus:ring-danger",
        className,
      )}
      {...rest}
    />
  );
}
