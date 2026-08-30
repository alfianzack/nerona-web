import { chatCompletion } from "@/lib/agent/claude-client";

/** 1x1 transparent PNG — the smallest thing that still exercises an image input. */
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export interface ProbeResult {
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

export interface AiConnectionTestResult {
  ok: boolean;
  configured: boolean;
  model: string;
  text: ProbeResult;
  vision: ProbeResult;
}

/**
 * Strips anything key-shaped out of an upstream error before it reaches the
 * browser. Upstream messages sometimes echo the request, and this result is
 * rendered in the admin UI.
 */
function safeMessage(err: unknown, apiKey: string): string {
  let message = err instanceof Error ? err.message : String(err);
  if (apiKey) message = message.split(apiKey).join("***");
  return message.replace(/sk-[A-Za-z0-9_-]{4,}/g, "***").slice(0, 300);
}

async function probe(
  messages: Array<{ role: string; content: unknown }>,
  model: string,
  apiKey: string,
  baseUrl: string
): Promise<ProbeResult> {
  try {
    await chatCompletion({ messages, model, apiKey, baseUrl, maxTokens: 16 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: safeMessage(err, apiKey) };
  }
}

export interface AiConnectionTestParams {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Menguji satu provider terhadap satu model id, dalam dua langkah supaya
 * kegagalannya bisa didiagnosis: probe teks (kuncinya sah dan modelnya
 * terjangkau?) dan probe gambar (modelnya bisa membaca gambar sama sekali?).
 * Extension mengirim gambar untuk setiap fitur metadata, jadi lulus teks saja
 * belum cukup untuk menyebut sebuah konfigurasi baik.
 *
 * Ongkosnya dua penyelesaian sangat kecil dengan kunci owner. Bukan poin tenant.
 */
export async function testAiConnection({
  apiKey,
  baseUrl,
  model,
}: AiConnectionTestParams): Promise<AiConnectionTestResult> {
  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      model,
      text: { ok: false, skipped: true },
      vision: { ok: false, skipped: true },
    };
  }

  const text = await probe([{ role: "user", content: "ping" }], model, apiKey, baseUrl);

  // A rejected key or unknown model fails both probes for the same reason —
  // don't spend a second call to learn nothing.
  if (!text.ok) {
    return { ok: false, configured: true, model, text, vision: { ok: false, skipped: true } };
  }

  const vision = await probe(
    [
      {
        role: "user",
        content: [
          { type: "text", text: "Reply with OK." },
          { type: "image_url", image_url: { url: `data:image/png;base64,${TINY_PNG}` } },
        ],
      },
    ],
    model,
    apiKey,
    baseUrl
  );

  return { ok: text.ok && vision.ok, configured: true, model, text, vision };
}
