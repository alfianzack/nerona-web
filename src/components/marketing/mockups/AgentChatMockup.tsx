export function AgentChatMockup() {
  return (
    <div className="rounded-3xl bg-white p-6 text-left shadow-2xl shadow-gray-950/10 ring-1 ring-gray-950/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Nerona Agent · WhatsApp
        </p>
        <span className="flex h-2 w-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2 text-sm text-white">
          Catat: Bu Sari pesan 2 keripik pedas, belum bayar
        </div>
        <div className="mr-auto max-w-[80%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2 text-sm text-gray-800 dark:bg-white/10 dark:text-gray-100">
          Siap! Pesanan Bu Sari sudah dicatat — 2 keripik pedas, status belum bayar. Ada lagi?
        </div>
      </div>
    </div>
  );
}
