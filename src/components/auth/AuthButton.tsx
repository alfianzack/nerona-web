interface AuthButtonProps {
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function AuthButton({
  type = "button",
  variant = "primary",
  disabled,
  onClick,
  children,
}: AuthButtonProps) {
  const base = "w-full rounded-full py-2.5 text-sm font-medium transition disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
      : "border border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900";

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
