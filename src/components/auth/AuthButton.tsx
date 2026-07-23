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
      ? "bg-gradient-to-br from-gold-500 to-gold-400 text-navy-900 font-semibold hover:brightness-110"
      : "bg-navy-900/5 text-ink ring-1 ring-navy-900/10 hover:bg-navy-900/10";

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
