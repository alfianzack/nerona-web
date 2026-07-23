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
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-surface to-surface2 p-8 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-muted">{subtitle}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
