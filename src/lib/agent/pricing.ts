export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * The rates one AI call is billed at. Resolved from admin settings
 * (`src/lib/ai-settings.ts`), never looked up by model id: the id the provider
 * returns need not match the one the owner configured, and a miss used to
 * silently under-charge.
 */
export interface AiPricing {
  inPerMTok: number; // USD per 1,000,000 input tokens
  outPerMTok: number; // USD per 1,000,000 output tokens
  pointsPerUsd: number;
}

/**
 * The last resort when nothing is configured — deliberately kept in step with
 * the rates actually stored in Pengaturan today.
 *
 * These must stay calibrated against the plan allowances in
 * `lib/plan-points.ts`, because AdminAiSettingsPanel invites the operator to
 * "Kosongkan untuk pakai default": clearing those three fields hands metering
 * over to this constant. The previous values (0.075 / 0.3 / 100,000) priced a
 * generate at ~24 points, which was sane when allowances were 5,000 and 15,000
 * but left Free (10 points) unable to buy a single generate once the allowances
 * were revised down. A default that silently disables every plan is a landmine,
 * not a fallback.
 */
export const DEFAULT_AI_PRICING: AiPricing = {
  inPerMTok: 0.25,
  outPerMTok: 1.5,
  pointsPerUsd: 1_000,
};

/**
 * Resolves what the operator has typed into the admin panel against the rates
 * currently in force, so the panel can preview a cost before anything is saved.
 * Mirrors the server-side rules in `ai-settings.ts`: blank, non-numeric and negative
 * all mean "keep the current value", and points-per-USD must be positive.
 */
export function pricingFromInput(
  input: { priceIn: string; priceOut: string; pointsPerUsd: string },
  effective: AiPricing
): AiPricing {
  const num = (raw: string, fallback: number, min = 0): number => {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  return {
    inPerMTok: num(input.priceIn, effective.inPerMTok),
    outPerMTok: num(input.priceOut, effective.outPerMTok),
    pointsPerUsd: num(input.pointsPerUsd, effective.pointsPerUsd, Number.MIN_VALUE),
  };
}

/**
 * Points always round UP, but only on a real fraction: binary floating point turns an
 * exact 975 into 975.0000000000001, and a bare ceil would over-charge a point for it.
 */
function toPoints(rawPoints: number): number {
  return Math.max(1, Math.ceil(Number(rawPoints.toFixed(6))));
}

/**
 * Pure: no env, no I/O, no model table. Safe to import from a client component so
 * the admin panel's estimate can never disagree with what is actually charged.
 */
export function costForUsage(params: { usage: TokenUsage | null; pricing: AiPricing }): number {
  const { pricing } = params;
  const usage = params.usage;
  if (!usage || (usage.promptTokens <= 0 && usage.completionTokens <= 0)) {
    console.warn("[pricing] missing token usage, charging conservative default cost");
    const fallbackUsd = (1000 / 1e6) * pricing.outPerMTok; // price a ~1k-token reply
    return toPoints(fallbackUsd * pricing.pointsPerUsd);
  }
  const usd =
    (usage.promptTokens / 1e6) * pricing.inPerMTok +
    (usage.completionTokens / 1e6) * pricing.outPerMTok;
  return toPoints(usd * pricing.pointsPerUsd);
}
