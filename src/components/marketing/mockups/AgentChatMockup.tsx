// "dark" renders the chat on a deep-navy card for use on the homepage's navy
// feature band; "light" keeps the original surface card used on /agent.
//
// Varian gelap tidak boleh memakai token permukaan: ink/muted/border disetel
// untuk latar terang. Di sana permukaan dan garisnya putih beralfa, sama
// seperti RejectAnalysisMockup, supaya kedua kartu di band navy sepadan.
export function AgentChatMockup({ theme = "light" }: { theme?: "light" | "dark" }) {
  const dark = theme === "dark";
  return (
    <div
      className={`rounded-card p-7 text-left ${
        dark ? "bg-white/5 ring-1 ring-white/10" : "bg-surface ring-1 ring-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`font-mono text-label uppercase ${dark ? "text-navy-100/75" : "text-muted"}`}
        >
          Nerona Agent · WhatsApp
        </p>
        <span className="flex h-2 w-2">
          <span className="h-2 w-2 rounded-full bg-success" />
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {/* Gelembung pengirim memakai aksen, bukan emas: emas hanya menandai
            aksi yang menggerakkan uang, dan itu tidak pernah di halaman publik. */}
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-accent px-4 py-2 text-body text-white">
          Catat: Bu Sari pesan 2 keripik pedas, belum bayar
        </div>
        <div
          className={`mr-auto max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2 text-body ${
            dark ? "bg-white/10 text-navy-100" : "bg-surface-sunken text-ink"
          }`}
        >
          Siap! Pesanan Bu Sari sudah dicatat — 2 keripik pedas, status belum bayar. Ada lagi?
        </div>
      </div>
    </div>
  );
}
