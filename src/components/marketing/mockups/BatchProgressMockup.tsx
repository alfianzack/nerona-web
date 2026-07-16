const BATCH_ITEMS = [
  { name: "IMG_0148.jpg", status: "Done" },
  { name: "IMG_0149.jpg", status: "Done" },
  { name: "IMG_0150.jpg", status: "Analyzing…" },
  { name: "IMG_0151.jpg", status: "Queued" },
];

export function BatchProgressMockup() {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Batch progress</p>
      <div className="mt-3 space-y-2">
        {BATCH_ITEMS.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-200">{item.name}</span>
            <span
              className={
                item.status === "Done"
                  ? "text-green-400"
                  : item.status === "Analyzing…"
                    ? "text-yellow-400"
                    : "text-gray-500"
              }
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
