const MARKETPLACES = ["Adobe Stock", "Shutterstock", "Vecteezy", "Canva"];

export function MarketplaceTabsMockup() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-7 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex flex-wrap gap-2">
        {MARKETPLACES.map((name, index) => (
          <span
            key={name}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              index === 0
                ? "bg-gradient-to-br from-gold-500 to-gold-400 text-navy-900"
                : "bg-navy-900/5 text-muted"
            }`}
          >
            {name}
          </span>
        ))}
      </div>
      <div className="mt-5 space-y-2.5 rounded-2xl bg-navy-900/5 p-5 ring-1 ring-navy-900/10">
        <div className="h-2 w-2/3 rounded-full bg-navy-900/10" />
        <div className="h-2 w-full rounded-full bg-navy-900/10" />
        <div className="h-2 w-1/2 rounded-full bg-navy-900/10" />
      </div>
      <p className="mt-4 text-xs text-muted/70">
        Terapkan Metadata → langsung mengisi formulir unggah Adobe Stock.
      </p>
    </div>
  );
}
