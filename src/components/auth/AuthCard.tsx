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
    <main className="flex flex-1 items-center justify-center bg-white px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 p-8 shadow-xl dark:border-gray-800">
        <h1 className="text-center text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
