import { cn } from "./cn";
import { Input } from "./Input";

/**
 * Label, isian, petunjuk, dan galat sebagai satu benda.
 *
 * Markup ini sebelumnya dijahit ulang di setiap formulir: layar auth punya
 * versinya sendiri, panel admin punya versinya sendiri, formulir toko punya
 * versinya sendiri. Menyatukannya di sini juga menyelesaikan hal yang selama
 * ini terlewat di semuanya: `aria-describedby` yang benar-benar menyambungkan
 * pesan galat ke isiannya, dan `aria-invalid` yang ikut menyala.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children?: never;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-caption font-medium text-muted">
        {label}
      </label>
      <Input id={id} invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />
      {hint && !error && (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
