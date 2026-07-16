const MARKETPLACES = ["Adobe Stock", "Freepik", "Vecteezy", "Shutterstock"];

export function MarketplaceRow() {
  return (
    <section className="bg-gray-100 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
        Works where you already upload
      </p>
      <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {MARKETPLACES.map((name) => (
          <span key={name} className="text-lg font-semibold text-gray-700">
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
