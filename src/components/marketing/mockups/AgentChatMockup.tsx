// "dark" renders the chat on a deep-navy card for use on the homepage's navy
// feature band; "light" keeps the original surface card used on /agent.
export function AgentChatMockup({ theme = "light" }: { theme?: "light" | "dark" }) {
  const dark = theme === "dark";
  return (
    <div
      className={`rounded-3xl p-6 text-left ${
        dark
          ? "bg-[#0E1B33] shadow-lg shadow-navy-950/50 ring-1 ring-white/10"
          : "bg-gradient-to-b from-surface to-surface2 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            dark ? "text-navy-100/70" : "text-muted/70"
          }`}
        >
          Nerona Agent · WhatsApp
        </p>
        <span className="flex h-2 w-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-gold-400/90 px-4 py-2 text-sm text-navy-900">
          Catat: Bu Sari pesan 2 keripik pedas, belum bayar
        </div>
        <div
          className={`mr-auto max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2 text-sm ${
            dark ? "bg-white/10 text-navy-100" : "bg-navy-900/5 text-ink"
          }`}
        >
          Siap! Pesanan Bu Sari sudah dicatat — 2 keripik pedas, status belum bayar. Ada lagi?
        </div>
      </div>
    </div>
  );
}
