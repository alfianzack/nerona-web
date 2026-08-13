import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-styles";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
};

/**
 * Sengaja tanpa "use client": komponen ini tidak memakai hook apa pun, jadi ia
 * ikut sifat pemanggilnya — tetap komponen server di halaman server, dan masuk
 * bundel klien hanya kalau induknya klien.
 */
export function Button({
  variant,
  size,
  full,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, full, className })} {...rest} />;
}
