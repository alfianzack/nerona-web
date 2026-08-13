const BATCH_ITEMS = [
  { name: "IMG_0148.jpg", status: "Selesai" },
  { name: "IMG_0149.jpg", status: "Selesai" },
  { name: "IMG_0150.jpg", status: "Menganalisis…" },
  { name: "IMG_0151.jpg", status: "Antre" },
];

export function BatchProgressMockup() {
  return (
    <div className="rounded-card bg-surface p-7 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <p className="font-mono text-label uppercase text-muted">Progres batch</p>
        <span className="font-mono text-caption tabular-nums text-muted">2/4</span>
      </div>
      <div className="mt-4 space-y-1">
        {BATCH_ITEMS.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-control px-3 py-2.5 text-caption odd:bg-surface-sunken"
          >
            {/* Nama berkas adalah identitas, bukan kalimat — karena itu mono. */}
            <span className="font-mono font-medium text-ink">{item.name}</span>
            <span
              className={
                item.status === "Selesai"
                  ? "text-success"
                  : item.status === "Menganalisis…"
                    ? "text-warning"
                    : "text-muted"
              }
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full w-1/2 rounded-full bg-accent" />
      </div>
    </div>
  );
}
