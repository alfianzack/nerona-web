import { Button } from "@/components/ui/Button";

interface AuthButtonProps {
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * Pembungkus tipis di atas Button.
 *
 * Tanda tangannya sengaja dibiarkan persis seperti semula supaya keempat
 * halaman auth tidak perlu disentuh saat fondasi dipasang. Berkas ini dihapus
 * di Gelombang 5, setelah pemanggilnya pindah ke Button langsung.
 *
 * Satu perubahan yang ikut terbawa: tombol ini akhirnya punya jejak fokus
 * papan ketik, karena aturan :focus-visible sekarang hidup di lapisan dasar.
 */
export function AuthButton({
  type = "button",
  variant = "primary",
  disabled,
  onClick,
  children,
}: AuthButtonProps) {
  return (
    <Button type={type} variant={variant} size="md" full disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
