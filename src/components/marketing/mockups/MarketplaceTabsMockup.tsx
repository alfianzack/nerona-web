const MARKETPLACES = ["Adobe Stock", "Shutterstock", "Vecteezy", "Canva"];

export function MarketplaceTabsMockup() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-7 shadow-lg shadow-black/40 ring-1 ring-white/10">
      <div className="flex flex-wrap gap-2">
        {MARKETPLACES.map((name, index) => (
          <span
            key={name}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              index === 0
                ? "bg-gradient-to-br from-gold-500 to-gold-400 text-navy-900"
                : "bg-white/10 text-navy-300"
            }`}
          >
            {name}
          </span>
        ))}
      </div>
      <div className="mt-5 space-y-2.5 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <div className="h-2 w-2/3 rounded-full bg-white/20" />
        <div className="h-2 w-full rounded-full bg-white/20" />
        <div className="h-2 w-1/2 rounded-full bg-white/20" />
      </div>
      <p className="mt-4 text-xs text-navy-300/70">
        Terapkan Metadata → langsung mengisi formulir unggah Adobe Stock.
      </p>
    </div>
  );
}
