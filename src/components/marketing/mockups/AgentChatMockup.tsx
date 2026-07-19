export function AgentChatMockup() {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-6 text-left shadow-lg shadow-black/40 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-navy-300/70">
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
        <div className="mr-auto max-w-[80%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-2 text-sm text-navy-100">
          Siap! Pesanan Bu Sari sudah dicatat — 2 keripik pedas, status belum bayar. Ada lagi?
        </div>
      </div>
    </div>
  );
}
