import Link from "next/link";

interface CtaLinkProps {
  href: string;
  tone?: "onDark" | "onLight";
  children: React.ReactNode;
}

export function CtaLink({ href, tone = "onLight", children }: CtaLinkProps) {
  const base = "inline-block rounded-full px-6 py-2.5 text-sm font-medium transition";
  const styles =
    tone === "onDark"
      ? "bg-white text-gray-900 hover:bg-gray-100"
      : "bg-gray-900 text-white hover:opacity-90";

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}
