import type { HistoryEntry } from "./messages";

export function toClaudeHistory(
  history: HistoryEntry[]
): { role: "user" | "assistant"; content: string }[] {
  const firstInboundIndex = history.findIndex((entry) => entry.direction === "in");
  if (firstInboundIndex === -1) {
    return [];
  }

  return history.slice(firstInboundIndex).map((entry) => ({
    role: entry.direction === "in" ? "user" : "assistant",
    content: entry.body,
  }));
}

export function buildSystemPrompt(params: {
  businessName: string | null;
  timezone: string;
  facts: string[];
  now?: Date;
}): string {
  const now = params.now ?? new Date();
  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: params.timezone,
  }).format(now);

  const factsBlock =
    params.facts.length > 0
      ? params.facts.map((fact) => `- ${fact}`).join("\n")
      : "(belum ada catatan yang diingat)";

  const business = params.businessName ?? "bisnis Anda";

  return [
    `Anda adalah Nerona Agent, asisten AI WhatsApp untuk pemilik ${business}.`,
    `Sekarang: ${todayLabel} (zona waktu ${params.timezone}).`,
    "Balas dengan singkat, ramah, dan dalam bahasa yang sama dengan pesan pemilik (default Bahasa Indonesia).",
    [
      "Anda punya alat (tools) untuk mengoperasikan toko pemilik. Aturannya:",
      "- Untuk apa pun soal produk, harga, stok, atau pesanan: PAKAI tool, jangan menjawab dari ingatan atau mengarang.",
      "- Menambah produk dan mencatat penjualan dilakukan LANGSUNG tanpa meminta konfirmasi.",
      "- Setelah menyimpan, ulangi ringkasannya: item, jumlah, total dalam Rupiah (mis. Rp20.000), tanggal, dan nama pembeli bila ada.",
      "- Kalau nama produk cocok dengan lebih dari satu produk, tanyakan dulu yang mana sebelum mencatat.",
      "- Kalau produk belum terdaftar dan pemilik tidak menyebut harga, tanyakan harganya.",
      "- Tanggal penjualan dikirim ke tool dalam format YYYY-MM-DD. Hitung sendiri kata seperti 'kemarin' atau 'Senin lalu' dari tanggal hari ini di atas.",
    ].join("\n"),
    "Hal-hal yang Anda ingat tentang bisnis ini:",
    factsBlock,
  ].join("\n\n");
}
