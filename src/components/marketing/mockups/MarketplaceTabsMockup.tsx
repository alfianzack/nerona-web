const MARKETPLACES = ["Adobe Stock", "Shutterstock", "Vecteezy", "Canva"];

export function MarketplaceTabsMockup() {
  return (
    <div className="rounded-card bg-surface p-7 ring-1 ring-border">
      <div className="flex flex-wrap gap-2">
        {MARKETPLACES.map((name, index) => (
          <span
            key={name}
            className={`rounded-chip px-3.5 py-1.5 text-caption font-medium ${
              index === 0 ? "bg-accent text-white" : "bg-surface-sunken text-muted"
            }`}
          >
            {name}
          </span>
        ))}
      </div>
      <div className="mt-5 space-y-2.5 rounded-card bg-surface-sunken p-5 ring-1 ring-border">
        {/* Batang abu-abu ini mewakili isian formulir, jadi warnanya sengaja
            setara garis rambut — bukan teks. */}
        <div className="h-2 w-2/3 rounded-full bg-border" />
        <div className="h-2 w-full rounded-full bg-border" />
        <div className="h-2 w-1/2 rounded-full bg-border" />
      </div>
      <p className="mt-4 text-caption text-muted">
        Terapkan Metadata → langsung mengisi formulir unggah Adobe Stock.
      </p>
    </div>
  );
}
