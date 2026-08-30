import type { AiProviderInput } from "@/lib/ai-providers";

/**
 * Kunci yang dikirim kosong berarti "biarkan yang tersimpan", jadi ia tidak
 * boleh ikut sebagai string kosong — itu akan menghapus kunci yang sudah ada.
 */
export function parseInput(body: any): AiProviderInput {
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  return {
    label: typeof body?.label === "string" ? body.label : "",
    baseUrl: typeof body?.baseUrl === "string" ? body.baseUrl : "",
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
    ...(apiKey ? { apiKey } : {}),
  };
}
