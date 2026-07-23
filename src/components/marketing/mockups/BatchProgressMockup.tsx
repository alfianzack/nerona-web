const BATCH_ITEMS = [
  { name: "IMG_0148.jpg", status: "Selesai" },
  { name: "IMG_0149.jpg", status: "Selesai" },
  { name: "IMG_0150.jpg", status: "Menganalisis…" },
  { name: "IMG_0151.jpg", status: "Antre" },
];

export function BatchProgressMockup() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-7 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted/70">Progres batch</p>
        <span className="text-xs text-muted">2/4</span>
      </div>
      <div className="mt-4 space-y-1">
        {BATCH_ITEMS.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm odd:bg-navy-900/5"
          >
            <span className="font-medium text-ink">{item.name}</span>
            <span
              className={
                item.status === "Selesai"
                  ? "text-emerald-400"
                  : item.status === "Menganalisis…"
                    ? "text-amber-400"
                    : "text-muted"
              }
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-navy-900/5">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-gold-500 to-gold-400" />
      </div>
    </div>
  );
}
