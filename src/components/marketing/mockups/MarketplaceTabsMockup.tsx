const MARKETPLACES = ["Adobe Stock", "Freepik", "Vecteezy", "Shutterstock"];

export function MarketplaceTabsMockup() {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6">
      <div className="flex gap-2">
        {MARKETPLACES.map((name, index) => (
          <span
            key={name}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              index === 0 ? "bg-white text-gray-900" : "bg-gray-700 text-gray-300"
            }`}
          >
            {name}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-2 rounded-xl bg-gray-900 p-4">
        <div className="h-2 w-2/3 rounded bg-gray-600" />
        <div className="h-2 w-full rounded bg-gray-600" />
        <div className="h-2 w-1/2 rounded bg-gray-600" />
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Apply Metadata → fills the Adobe Stock upload form directly.
      </p>
    </div>
  );
}
