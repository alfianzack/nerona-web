interface AuthInputProps {
  label: string;
  type: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
}

export function AuthInput({
  label,
  type,
  name,
  value,
  onChange,
  error,
  autoComplete,
}: AuthInputProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-4 py-2.5 text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-gray-900 dark:text-white dark:focus:ring-white ${
          error ? "border-red-500" : "border-gray-300 dark:border-gray-700"
        }`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
