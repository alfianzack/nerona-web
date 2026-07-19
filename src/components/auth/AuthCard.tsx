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
    <main className="flex flex-1 items-center justify-center bg-navy-950 px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-8 shadow-lg shadow-black/40 ring-1 ring-white/10">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-navy-300">{subtitle}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
