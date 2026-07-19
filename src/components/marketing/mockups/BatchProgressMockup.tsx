const BATCH_ITEMS = [
  { name: "IMG_0148.jpg", status: "Selesai" },
  { name: "IMG_0149.jpg", status: "Selesai" },
  { name: "IMG_0150.jpg", status: "Menganalisis…" },
  { name: "IMG_0151.jpg", status: "Antre" },
];

export function BatchProgressMockup() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-7 shadow-lg shadow-black/40 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-300/70">Progres batch</p>
        <span className="text-xs text-navy-300">2/4</span>
      </div>
      <div className="mt-4 space-y-1">
        {BATCH_ITEMS.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm odd:bg-white/5"
          >
            <span className="font-medium text-navy-100">{item.name}</span>
            <span
              className={
                item.status === "Selesai"
                  ? "text-emerald-400"
                  : item.status === "Menganalisis…"
                    ? "text-amber-400"
                    : "text-navy-300"
              }
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-gold-500 to-gold-400" />
      </div>
    </div>
  );
}
