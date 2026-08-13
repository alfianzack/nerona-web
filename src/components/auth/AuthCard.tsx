import { Card } from "@/components/ui/Card";

/**
 * Pembungkus tipis di atas Card, tanda tangan tidak berubah.
 *
 * Layar auth ikut permukaan pemasaran, jadi radiusnya, garisnya, dan warnanya
 * datang dari [data-surface="marketing"] di layout grup (auth).
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card padding="lg" className="w-full max-w-sm">
        <h1 className="text-center text-title-1 text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-body text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </Card>
    </main>
  );
}
