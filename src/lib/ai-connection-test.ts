import { getAiSettings } from "@/lib/ai-settings";
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
  apiKey: string
): Promise<ProbeResult> {
  try {
    await chatCompletion({ messages, model, apiKey, maxTokens: 16 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: safeMessage(err, apiKey) };
  }
}

/**
 * Verifies the admin AI settings actually work, in two steps so a failure is
 * diagnosable: a text probe (is the key valid and the model reachable?) and an
 * image probe (can the model read images at all?). The extension sends images
 * for every metadata feature, so a text-only pass is not enough to call the
 * configuration good.
 *
 * Costs two very small completions against the admin key. No tenant points.
 */
export async function testAiConnection(): Promise<AiConnectionTestResult> {
  const { model, apiKey } = await getAiSettings();

  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      model,
      text: { ok: false, skipped: true },
      vision: { ok: false, skipped: true },
    };
  }

  const text = await probe([{ role: "user", content: "ping" }], model, apiKey);

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
    apiKey
  );

  return { ok: text.ok && vision.ok, configured: true, model, text, vision };
}
