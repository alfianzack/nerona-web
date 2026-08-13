import Link from "next/link";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-styles";

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
};

/**
 * Komponen terpisah, bukan prop `as` di Button.
 *
 * Sebuah tautan butuh `href` dan tidak pernah punya `disabled` atau `type`;
 * sebuah tombol kebalikannya. Menyatukan keduanya di balik satu prop berarti
 * salah satu tanda tangan tipenya harus berbohong.
 */
export function ButtonLink({
  variant,
  size,
  full,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, full, className })} {...rest} />;
}
