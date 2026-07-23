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
      ? "bg-white text-blue-700 hover:bg-blue-50"
      : "bg-blue-600 text-ink hover:bg-blue-700";

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}
