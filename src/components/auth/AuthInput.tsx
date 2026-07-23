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
    <div className="mb-4">
      <label
        htmlFor={name}
        className="mb-1.5 block text-sm font-medium text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl bg-navy-900/5 px-4 py-2.5 text-ink ring-1 ring-navy-900/10 transition placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400 ${
          error ? "ring-2 ring-rose-400" : ""
        }`}
      />
      {error && <p className="mt-1.5 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
