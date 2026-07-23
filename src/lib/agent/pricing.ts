export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

interface ModelPrice {
  in: number; // USD per 1,000,000 input tokens
  out: number; // USD per 1,000,000 output tokens
}

// Placeholder rates — confirm against the provider's real pricing.
const MODEL_PRICES: Record<string, ModelPrice> = {
  "gemini-2.0-flash-lite": { in: 0.075, out: 0.3 },
  "gemini-2.0-flash": { in: 0.1, out: 0.4 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
};

const DEFAULT_PRICE = MODEL_PRICES["gemini-2.0-flash-lite"];

function pointsPerUsd(): number {
  const v = Number(process.env.POINTS_PER_USD);
  return Number.isFinite(v) && v > 0 ? v : 100_000;
}

export function costForUsage(params: { model: string; usage: TokenUsage | null }): number {
  // An unknown model falls back to the cheapest entry in MODEL_PRICES rather than
  // charging 0. This can UNDER-charge if the actual model served is pricier than the
  // cheap default — it never over-charges. Any model actually served in production
  // should be added to MODEL_PRICES so it is priced accurately.
  const price = MODEL_PRICES[params.model] ?? DEFAULT_PRICE;
  if (params.model && !MODEL_PRICES[params.model]) {
    console.warn(`[pricing] unknown model "${params.model}", using default price`);
  }
  const usage = params.usage;
  if (!usage || (usage.promptTokens <= 0 && usage.completionTokens <= 0)) {
    console.warn("[pricing] missing token usage, charging conservative default cost");
    const fallbackUsd = (1000 / 1e6) * price.out; // price a ~1k-token reply
    return Math.max(1, Math.ceil(fallbackUsd * pointsPerUsd()));
  }
  const usd = (usage.promptTokens / 1e6) * price.in + (usage.completionTokens / 1e6) * price.out;
  return Math.max(1, Math.ceil(usd * pointsPerUsd()));
}
