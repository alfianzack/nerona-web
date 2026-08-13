import { Field } from "@/components/ui/Field";

interface AuthInputProps {
  label: string;
  type: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}

/**
 * Pembungkus tipis di atas Field, tanda tangan tidak berubah.
 *
 * Yang ikut terbawa tanpa mengubah pemanggil: pesan galat sekarang benar-benar
 * tersambung ke isiannya lewat aria-describedby, dan isiannya menyalakan
 * aria-invalid. Sebelumnya galat hanya sebuah <p> merah yang tidak dikenali
 * pembaca layar sebagai milik isian itu.
 */
export function AuthInput({
  label,
  type,
  name,
  value,
  onChange,
  error,
  autoComplete,
  required,
  placeholder,
}: AuthInputProps) {
  return (
    <Field
      id={name}
      name={name}
      label={label}
      type={type}
      value={value}
      error={error}
      autoComplete={autoComplete}
      required={required}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="mb-4"
    />
  );
}
